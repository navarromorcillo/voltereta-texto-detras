#!/bin/bash
# Arranca un servidor local y abre la herramienta en el navegador.
cd "$(dirname "$0")"
PORT=8080
if ! lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 1
fi
open "http://localhost:$PORT/"
echo "La herramienta está abierta en http://localhost:$PORT/"
echo "Puedes cerrar esta ventana; el servidor se cerrará al cerrar sesión."
