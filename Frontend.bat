@echo off

REM Guarda este archivo como .bat y ponlo en la carpeta donde esta el backen y el front
pushd %~dp0produccion-app
npm run dev
popd
