// Composición: foto de fondo, texto con glow y persona recortada por encima.
// Funciona en navegador (script clásico, expone VolteretaCompose) y en Node (require).

const VolteretaCompose = (function () {
const defaults = {
  small: 'Probamos el',
  big: 'Menú Bento',
  y: 0.3,          // centro del bloque de texto, fracción de la altura
  smallSize: 0.085, // fracción del ancho
  bigSize: 0.17,
  glow: 0.03,      // radio del desenfoque, fracción del ancho
  glowOpacity: 0.85,
  darken: 0.12,    // oscurecer fondo detrás de la persona (0–1)
  color: '#ffffff',
  font: 'New Spirit',
  cutout: true,
};

// mask: { width, height, data } con un canal (0–255), o null.
function maskToCanvas(createCanvas, mask, feather = 1) {
  const c = createCanvas(mask.width, mask.height);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(mask.width, mask.height);
  const d = img.data;
  const ch = mask.channels || 1;
  for (let i = 0, j = 0; i < mask.data.length; i += ch, j += 4) {
    d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; d[j + 3] = mask.data[i];
  }
  ctx.putImageData(img, 0, 0);
  if (feather > 0) {
    const f = createCanvas(mask.width, mask.height);
    const fctx = f.getContext('2d');
    fctx.filter = `blur(${feather}px)`;
    fctx.drawImage(c, 0, 0);
    return f;
  }
  return c;
}

function makeCutout(createCanvas, image, maskCanvas, width, height) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0, width, height);
  return c;
}

function drawTextLayer(createCanvas, ctx, width, height, o) {
  const smallPx = Math.round(width * o.smallSize);
  const bigPx = Math.round(width * o.bigSize);
  const gap = Math.round(bigPx * 0.02);
  const total = (o.small ? smallPx : 0) + (o.small && o.big ? gap : 0) + (o.big ? bigPx : 0);
  const top = height * o.y - total / 2;
  const cx = width / 2;
  const lines = [];
  let cursor = top;
  if (o.small) { lines.push({ text: o.small, px: smallPx, y: cursor + smallPx * 0.5 }); cursor += smallPx + gap; }
  if (o.big) { lines.push({ text: o.big, px: bigPx, y: cursor + bigPx * 0.5 }); }

  // El texto nítido se pinta en una capa aparte; el glow es esa capa desenfocada.
  const layer = createCanvas(width, height);
  const lctx = layer.getContext('2d');
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  lctx.fillStyle = o.color;
  for (const l of lines) {
    lctx.font = `500 ${l.px}px "${o.font}"`;
    lctx.fillText(l.text, cx, l.y);
  }

  const r = Math.max(0, width * o.glow);
  if (r > 0 && o.glowOpacity > 0) {
    for (const [radius, alpha] of [[r, o.glowOpacity], [r * 0.4, o.glowOpacity * 0.7]]) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(layer, 0, 0);
}

// Devuelve un canvas final. cutoutCanvas puede ser null (texto por delante).
function compose(createCanvas, { image, cutoutCanvas, width, height, options }) {
  const o = { ...defaults, ...options };
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  if (o.darken > 0) {
    ctx.fillStyle = `rgba(0,0,0,${o.darken})`;
    ctx.fillRect(0, 0, width, height);
  }
  drawTextLayer(createCanvas, ctx, width, height, o);
  if (o.cutout && cutoutCanvas) ctx.drawImage(cutoutCanvas, 0, 0, width, height);
  return c;
}

  return { defaults, maskToCanvas, makeCutout, compose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VolteretaCompose;
