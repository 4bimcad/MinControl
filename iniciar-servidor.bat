@echo off
echo Iniciando MinControl...
echo Abra su navegador en: http://localhost:8000
echo (No cierre esta ventana mientras usa la aplicacion)
start http://localhost:8000
python -m http.server 8000
pause
