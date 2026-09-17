@echo off

REM Guarda este archivo como .bat y ponlo en la carpeta donde esta el backen y el front
echo Deteniendo procesos de Node.js anteriores...
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

pushd %~dp0backend
echo Iniciando servidor backend...
start /B node server.js
popd

echo Servidor iniciado. Abre tu navegador en http://FMM-C-023:3000
