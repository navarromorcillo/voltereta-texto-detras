# Texto detrás · Voltereta

Herramienta para marketing: sube una foto, escribe dos líneas de texto y descarga la imagen con el texto detrás de la persona, con glow y en la tipografía New Spirit.

Todo corre en el navegador. No hay servidor ni servicios de pago: el recorte lo hace el modelo MODNet (licencia Apache 2.0) descargado desde Hugging Face la primera vez y guardado en caché.

## Abrir

Doble clic en `index.html`. Funciona directamente desde la carpeta, sin servidor, en Chrome, Safari o Firefox actuales. Hace falta conexión a internet la primera vez para descargar el modelo de recorte.

Alternativa: doble clic en `Abrir texto detras.command`, que arranca un servidor local y abre http://localhost:8080.

## Publicar gratis

Es una web estática. Basta subir la carpeta a GitHub Pages, Netlify o Vercel.

## Archivos

- `index.html`, `style.css`: interfaz.
- `app.js`: carga de fotos, recorte y descarga.
- `compose.js`: composición (foto, texto con glow, persona recortada). Script clásico que expone `VolteretaCompose`; en Node se carga con `require`.
- `Abrir texto detras.command`: lanzador opcional con servidor local.
- `fonts/`: New Spirit regular y medium.
