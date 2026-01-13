# Script para configurar el archivo fuente de ProductionReport
# Ejecutar desde el directorio backend

Write-Host "=== Configurador de Archivo Fuente ProductionReport ===" -ForegroundColor Cyan
Write-Host ""

# Buscar archivos ProductionReport en data/
$dataDir = Join-Path $PSScriptRoot "data"
$reportFiles = Get-ChildItem -Path $dataDir -Filter "ProductionReport*.csv" | Sort-Object Name -Descending

if ($reportFiles.Count -eq 0) {
    Write-Host "No se encontraron archivos ProductionReport en data/" -ForegroundColor Red
    exit 1
}

Write-Host "Archivos ProductionReport disponibles:" -ForegroundColor Yellow
Write-Host ""

for ($i = 0; $i -lt $reportFiles.Count; $i++) {
    $file = $reportFiles[$i]
    $sizeKB = [math]::Round($file.Length / 1KB, 2)
    Write-Host "[$($i+1)] $($file.Name) - $sizeKB KB - $($file.LastWriteTime)" -ForegroundColor White
}

Write-Host ""
Write-Host "Selecciona el archivo a usar (1-$($reportFiles.Count)): " -NoNewline -ForegroundColor Green
$selection = Read-Host

$index = [int]$selection - 1
if ($index -lt 0 -or $index -ge $reportFiles.Count) {
    Write-Host "Selección inválida" -ForegroundColor Red
    exit 1
}

$selectedFile = $reportFiles[$index]
$fullPath = $selectedFile.FullName

Write-Host ""
Write-Host "Archivo seleccionado: $($selectedFile.Name)" -ForegroundColor Green
Write-Host "Ruta completa: $fullPath" -ForegroundColor Gray
Write-Host ""

# Verificar si existe .env
$envFile = Join-Path $PSScriptRoot ".env"
$envExists = Test-Path $envFile

if (-not $envExists) {
    Write-Host ".env no existe. Creando desde EnvSample..." -ForegroundColor Yellow
    $envSample = Join-Path $PSScriptRoot "EnvSample"
    if (Test-Path $envSample) {
        Copy-Item $envSample $envFile
        Write-Host ".env creado" -ForegroundColor Green
    } else {
        Write-Host "EnvSample no encontrado. Creando .env vacío..." -ForegroundColor Yellow
        New-Item -Path $envFile -ItemType File | Out-Null
    }
}

# Leer contenido del .env
$envContent = Get-Content $envFile -Raw

# Actualizar o agregar REA_SOURCE_FILE_PATH
$newLine = "REA_SOURCE_FILE_PATH=$fullPath"

if ($envContent -match "REA_SOURCE_FILE_PATH=.*") {
    # Reemplazar línea existente
    $envContent = $envContent -replace "REA_SOURCE_FILE_PATH=.*", $newLine
    Write-Host "REA_SOURCE_FILE_PATH actualizado en .env" -ForegroundColor Green
} else {
    # Agregar nueva línea
    if (-not $envContent.EndsWith("`n")) {
        $envContent += "`n"
    }
    $envContent += "$newLine`n"
    Write-Host "REA_SOURCE_FILE_PATH agregado a .env" -ForegroundColor Green
}

# Guardar cambios
Set-Content -Path $envFile -Value $envContent -NoNewline

Write-Host ""
Write-Host "Configuración completada!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para aplicar los cambios:" -ForegroundColor Yellow
Write-Host "1. Reinicia el servidor backend" -ForegroundColor White
Write-Host "2. Los archivos EOL_Cuts.csv y EOL_Cuts_OEE.csv se regenerarán automáticamente" -ForegroundColor White
Write-Host ""
Write-Host "Para verificar la configuración actual:" -ForegroundColor Yellow
Write-Host "  Get-Content .env | Select-String 'REA_SOURCE_FILE_PATH'" -ForegroundColor Gray
Write-Host ""
