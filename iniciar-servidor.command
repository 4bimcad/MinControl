#!/bin/bash
cd "$(dirname "$0")"
echo "Iniciando MinControl..."
echo "Abra su navegador en: http://localhost:8000"
open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null
python3 -m http.server 8000
