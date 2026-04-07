# Script para empaquetar la aplicación para distribución
# Ejecutar desde la raíz del proyecto: .\package-app.ps1

Write-Host "=== Empaquetando Production Dashboard ===" -ForegroundColor Cyan

# Crear carpeta de distribución
$distFolder = ".\ProductionApp-Distributable"
if (Test-Path $distFolder) {
    Write-Host "Eliminando carpeta de distribución anterior..." -ForegroundColor Yellow
    Remove-Item $distFolder -Recurse -Force
}

Write-Host "Creando carpeta de distribución..." -ForegroundColor Green
New-Item -ItemType Directory -Path $distFolder | Out-Null

# 1. Copiar el ejecutable del backend
Write-Host "Copiando backend.exe..." -ForegroundColor Green
Copy-Item ".\backend\dist\backend.exe" -Destination $distFolder

# 2. Copiar carpeta data completa
Write-Host "Copiando carpeta data/..." -ForegroundColor Green
Copy-Item ".\backend\data" -Destination "$distFolder\data" -Recurse

# 3. Copiar frontend compilado
Write-Host "Copiando frontend compilado..." -ForegroundColor Green
Copy-Item ".\produccion-app\dist" -Destination "$distFolder\produccion-app\dist" -Recurse

# 4. Copiar archivos de configuración
Write-Host "Copiando archivos de configuración..." -ForegroundColor Green
Copy-Item ".\backend\options.json" -Destination $distFolder -ErrorAction SilentlyContinue
Copy-Item ".\backend\categories.json" -Destination $distFolder -ErrorAction SilentlyContinue
Copy-Item ".\backend\shifts.json" -Destination $distFolder -ErrorAction SilentlyContinue

# 5. Crear .env con rutas relativas
Write-Host "Creando archivo .env de ejemplo..." -ForegroundColor Green
$envContent = @"
# Configuración de Production Dashboard
# Ajusta estos valores según tu instalación

PORT=3000
HOST=0.0.0.0

# Rutas a archivos de datos (relativas al ejecutable)
PRODUCTION_FILE_PATH=./data/ProductionReport.csv
STOPS_FILE_PATH=./data/paros.csv
OPTIONS_FILE_PATH=./options.json
CATEGORIES_FILE_PATH=./categories.json
REA_SOURCE_FILE_PATH=./data/ProductionReport.csv
EFFICIENCY_FILE_PATH=./data/efficiency.csv
PRODUCTION_TIMESTAMPS_FILE_PATH=./data/ProductionReport.csv
HRPERHR_FILE_PATH=./data/HrperHrReport.csv

# Configuración CORS
CORS_ORIGIN=*

# Backups automáticos
STOPS_BACKUP_DIR=./data/paros_backup
STOPS_BACKUP_TIME=23:59
STOPS_AUTO_BACKUP=true

# Generación automática de EOL Cuts
AUTO_GENERATE_EOL=false
AUTO_GENERATE_INTERVAL=60000

# Sistema de licencias
LICENSE_FILE=./license.key
"@

Set-Content -Path "$distFolder\.env" -Value $envContent

# 6. Crear README con instrucciones
Write-Host "Creando README de instalación..." -ForegroundColor Green
$readmeContent = @"
# Production Dashboard - Instalación

## Requisitos
- Windows 10/11 (64-bit)
- **NO requiere Node.js instalado**

## Instalación

1. **Copiar esta carpeta completa** a la ubicación deseada en la nueva PC

2. **Configurar el archivo .env**:
   - Abre el archivo `.env` con un editor de texto
   - Ajusta el puerto si es necesario: `PORT=3000`
   - Si quieres acceder desde otras PCs en la red, cambia `HOST=0.0.0.0`
   - Las rutas ya están configuradas como relativas y funcionarán automáticamente

3. **Ejecutar la aplicación**:
   - Doble clic en `backend.exe`
   - O desde PowerShell: `.\backend.exe`

4. **Acceder a la aplicación**:
   - Abre tu navegador en: `http://localhost:3000`
   - Desde otra PC en la red: `http://[IP-DEL-SERVIDOR]:3000`

## Estructura de archivos

```
ProductionApp-Distributable/
├── backend.exe              # Aplicación principal (backend + frontend)
├── .env                     # Configuración
├── options.json             # Opciones de la app
├── categories.json          # Categorías
├── shifts.json              # Turnos
├── data/                    # Datos de producción
│   ├── paros.csv
│   ├── ProductionReport.csv
│   ├── efficiency.csv
│   └── ...
└── produccion-app/
    └── dist/                # Frontend compilado
```

## Notas importantes

- **Todos los archivos deben permanecer juntos** en la misma estructura
- Los datos se guardan en la carpeta `data/`
- Los backups automáticos se crean en `data/paros_backup/`
- El ejecutable NO expone el código fuente

## Problemas comunes

**Error: Puerto en uso**
- Cambia el `PORT=3000` en el archivo `.env` a otro puerto (ej: 3001)

**No se puede acceder desde otra PC**
- Verifica que `HOST=0.0.0.0` en el archivo `.env`
- Verifica el firewall de Windows (debe permitir conexiones entrantes en el puerto 3000)

**Archivos no encontrados**
- Verifica que todas las carpetas (`data/`, `produccion-app/dist/`) estén presentes
- Verifica que las rutas en `.env` sean relativas (comienzan con `./`)

## Soporte

Para más información, contacta al administrador del sistema.
"@

Set-Content -Path "$distFolder\README.txt" -Value $readmeContent

# 7. Crear script de inicio rápido
Write-Host "Creando script de inicio..." -ForegroundColor Green
$startScript = @"
@echo off
echo ========================================
echo  Production Dashboard
echo ========================================
echo.
echo Iniciando servidor...
echo.
echo Accede a la aplicacion en:
echo   http://localhost:3000
echo.
echo Presiona Ctrl+C para detener el servidor
echo.
backend.exe
pause
"@

Set-Content -Path "$distFolder\INICIAR.bat" -Value $startScript

# Resumen
Write-Host "`n=== Empaquetado completado ===" -ForegroundColor Cyan
Write-Host "Carpeta creada: $distFolder" -ForegroundColor Green
Write-Host "`nContenido:" -ForegroundColor Yellow
Get-ChildItem $distFolder -Recurse -Depth 1 | Select-Object FullName

$size = (Get-ChildItem $distFolder -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "`nTamaño total: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan

Write-Host "`nListo para distribuir!" -ForegroundColor Green
Write-Host "Comprime la carpeta '$distFolder' y compártela." -ForegroundColor Yellow
