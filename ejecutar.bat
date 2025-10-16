@echo off
ECHO Iniciando el servidor de produccion en http://localhost:5000/BricoFrank/...

REM --- 1. Abrir la URL con el subdirectorio en el navegador
start http://localhost:5000/BricoFrank/

REM --- 2. Servir la carpeta 'dist'
serve -s dist -l 5000

PAUSE