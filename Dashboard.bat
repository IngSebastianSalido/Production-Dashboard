@echo off

REM Cambia a la carpeta backend y ejecuta el servidor Node.js en segundo plano
pushd %~dp0backend
start /B node server.js
popd

REM Cambia a la carpeta produccion-app y ejecuta el script de desarrollo
pushd %~dp0produccion-app
npm run dev
popd
