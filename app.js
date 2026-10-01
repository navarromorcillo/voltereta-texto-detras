const { compose, maskToCanvas, makeCutout, defaults } = VolteretaCompose;
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let lib = null; // { pipeline, env, RawImage }

async function getLib() {
  if (!lib) {
    lib = await import(LIB_URL);
    lib.env.allowLocalModels = false;
  }
  return lib;
}

const MAX_SIDE = 2200;     // resolución máxima de la imagen de salida
const PREVIEW_SIDE = 900;  // resolución de la vista previa

const $ = (id) => document.getElementById(id);
const createCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const ui = {
  drop: $('drop'), file: $('file'), thumbs: $('thumbs'), status: $('status'),
  preview: $('preview'), empty: $('empty'), download: $('download'), downloadAll: $('downloadAll'),
  format: $('format'),
  small: $('small'), big: $('big'), y: $('y'), bigSize: $('bigSize'), smallSize: $('smallSize'),
  glow: $('glow'), glowOpacity: $('glowOpacity'), darken: $('darken'), cutout: $('cutout'), color: $('color'),
};
const optionKeys = ['small', 'big', 'y', 'bigSize', 'smallSize', 'glow', 'glowOpacity', 'darken', 'cutout', 'color'];

const items = [];       // { name, image, width, height, maskCanvas, options, thumb }
let current = null;
let segmenter = null;
let modelPromise = null;
let lastOptions = { ...defaults };

const setStatus = (t) => { ui.status.textContent = t; };

// ---------- modelo de recorte ----------
async function getSegmenter() {
  if (segmenter) return segmenter;
  if (!modelPromise) {
    modelPromise = (async () => {
      setStatus('Preparando el modelo de recorte, solo tarda la primera vez…');
      const opts = {
        dtype: 'fp32',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.file && p.file.endsWith('.onnx')) {
            setStatus(`Descargando el modelo de recorte… ${Math.round(p.progress)} %`);
          }
        },
      };
      const { pipeline } = await getLib();
      let seg;
      try {
        seg = await pipeline('image-segmentation', 'Xenova/modnet', { ...opts, device: 'webgpu' });
      } catch (e) {
        console.warn('WebGPU no disponible, usando wasm', e);
        seg = await pipeline('image-segmentation', 'Xenova/modnet', { ...opts, device: 'wasm' });
      }
      setStatus('');
      segmenter = seg;
      return seg;
    })();
  }
  return modelPromise;
}

async function segment(canvas) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const { RawImage, pipeline } = await getLib();
  const raw = await RawImage.fromBlob(blob);
  let seg = await getSegmenter();
  let out;
  try {
    out = await seg(raw);
  } catch (e) {
    // Si la inferencia en WebGPU falla, se reconstruye en wasm.
    console.warn('Fallo en inferencia, reintentando con wasm', e);
    segmenter = await pipeline('image-segmentation', 'Xenova/modnet', { dtype: 'fp32', device: 'wasm' });
    out = await segmenter(raw);
  }
  return out[0].mask;
}

// ---------- carga de fotos ----------
async function loadFile(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const image = createCanvas(width, height);
  image.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const item = {
    name: file.name.replace(/\.[^.]+$/, ''),
    image, width, height, maskCanvas: null, ready: false,
    options: { ...lastOptions },
  };
  const thumb = document.createElement('img');
  thumb.src = image.toDataURL('image/jpeg', 0.6);
  thumb.title = file.name;
  thumb.addEventListener('click', () => select(item));
  item.thumb = thumb;
  ui.thumbs.appendChild(thumb);
  ui.thumbs.hidden = false;
  items.push(item);
  if (items.length > 1) ui.downloadAll.hidden = false;
  return item;
}

async function addFiles(files) {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  const added = [];
  for (const f of list) added.push(await loadFile(f));
  select(added[0]);
  for (const item of added) {
    setStatus(`Recortando ${item.name}…`);
    try {
      const mask = await segment(item.image);
      item.maskCanvas = maskToCanvas(createCanvas, mask, 1);
    } catch (e) {
      console.error(e);
      setStatus('No se ha podido recortar la persona. Se muestra el texto por delante.');
      item.options.cutout = false;
    }
    item.ready = true;
    if (item === current) { syncControls(); render(); }
  }
  if (ui.status.textContent.startsWith('Recortando')) setStatus('');
  updateButtons();
}

// ---------- selección y controles ----------
function select(item) {
  if (current) current.thumb.classList.remove('active');
  current = item;
  item.thumb.classList.add('active');
  syncControls();
  render();
  updateButtons();
}

function syncControls() {
  const o = current ? current.options : lastOptions;
  for (const k of optionKeys) {
    const el = ui[k];
    if (el.type === 'checkbox') el.checked = !!o[k]; else el.value = o[k];
  }
  ui.cutout.disabled = !(current && current.maskCanvas);
}

function readControls() {
  const o = {};
  for (const k of optionKeys) {
    const el = ui[k];
    if (el.type === 'checkbox') o[k] = el.checked;
    else if (el.type === 'range') o[k] = parseFloat(el.value);
    else o[k] = el.value;
  }
  o.small = o.small.trim();
  o.big = o.big.trim();
  return o;
}

function updateButtons() {
  ui.download.disabled = !(current && current.ready);
  ui.downloadAll.disabled = !items.every((i) => i.ready);
}

// ---------- render ----------
let frame = 0;
function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!current) return;
    ui.empty.hidden = true;
    const scale = Math.min(1, PREVIEW_SIDE / Math.max(current.width, current.height));
    const w = Math.round(current.width * scale);
    const h = Math.round(current.height * scale);
    const cut = current.maskCanvas ? makeCutout(createCanvas, current.image, current.maskCanvas, w, h) : null;
    const out = compose(createCanvas, { image: current.image, cutoutCanvas: cut, width: w, height: h, options: current.options });
    ui.preview.width = w;
    ui.preview.height = h;
    ui.preview.getContext('2d').drawImage(out, 0, 0);
  });
}

function renderFull(item) {
  const cut = item.maskCanvas ? makeCutout(createCanvas, item.image, item.maskCanvas, item.width, item.height) : null;
  return compose(createCanvas, { image: item.image, cutoutCanvas: cut, width: item.width, height: item.height, options: item.options });
}

async function download(item) {
  const type = ui.format.value;
  const canvas = renderFull(item);
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.93));
  const slug = (item.options.big || item.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}.${type === 'image/png' ? 'png' : 'jpg'}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- eventos ----------
for (const k of optionKeys) {
  ui[k].addEventListener('input', () => {
    const o = readControls();
    lastOptions = o;
    if (current) { current.options = o; render(); }
  });
}
ui.download.addEventListener('click', () => current && download(current));
ui.downloadAll.addEventListener('click', async () => {
  for (const item of items) { await download(item); await new Promise((r) => setTimeout(r, 400)); }
});
ui.file.addEventListener('change', () => { addFiles(ui.file.files); ui.file.value = ''; });
['dragenter', 'dragover'].forEach((ev) => ui.drop.addEventListener(ev, (e) => { e.preventDefault(); ui.drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => ui.drop.addEventListener(ev, (e) => { e.preventDefault(); ui.drop.classList.remove('over'); }));
ui.drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
document.addEventListener('paste', (e) => {
  const files = Array.from(e.clipboardData?.files || []);
  if (files.length) addFiles(files);
});

// ---------- arranque ----------
(async () => {
  syncControls();
  await document.fonts.load('500 20px "New Spirit"').catch(() => {});
  getSegmenter().catch((e) => { console.error(e); setStatus('No se ha podido cargar el modelo de recorte. Hace falta conexión a internet la primera vez. Recarga la página.'); });
})();
