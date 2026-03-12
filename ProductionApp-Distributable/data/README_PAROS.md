# Sistema de Archivos de Paros por Año

## Descripción

El sistema ahora maneja archivos de paros separados por año para mejorar la organización y el rendimiento.

## Formato de Archivos

- **Nombre**: `paros_YYYY.csv` (ejemplo: `paros_2025.csv`, `paros_2026.csv`)
- **Ubicación**: `backend/data/`
- **Creación**: Los archivos se crean automáticamente cuando se registra el primer paro de un año nuevo

## Estructura del CSV

```
fecha;area;linea;pn;hora_paro;hora_arranque;diferencia_minutos;categoria;estacion;modo_falla;descripcion_modo_falla;descripcion
```

## Funcionalidades

### 1. Registro de Paros
- Al registrar un paro, el sistema determina automáticamente el año de la fecha y guarda en el archivo correspondiente
- Si el archivo del año no existe, se crea automáticamente con los encabezados correctos
- **Caso especial**: Si un paro cruza medianoche Y cambia de año (ej: 31-dic-2025 23:30 a 01-ene-2026 01:00):
  - La primera parte se guarda en `paros_2025.csv`
  - La segunda parte se guarda en `paros_2026.csv`

### 2. Consulta de Paros
- Los endpoints GET leen **TODOS** los archivos de paros disponibles
- Los datos se combinan automáticamente antes de devolverlos
- Esto permite consultar paros de múltiples años en una sola petición

### 3. Eliminación de Paros
- Al eliminar un paro, el sistema usa la fecha para determinar el archivo correcto
- Solo se modifica el archivo del año correspondiente

### 4. Respaldos Automáticos
- El sistema crea respaldos de **TODOS** los archivos de paros
- Los respaldos se guardan en `backend/data/paros_backup/`
- Formato: `paros_YYYY_TIMESTAMP.csv`

## Migración desde el Sistema Anterior

El archivo `paros.csv` original fue renombrado a `paros_2025.csv` para mantener los datos históricos.

## Variables de Entorno

```env
# Directorio base para archivos de paros (opcional)
STOPS_BASE_DIR=/ruta/al/directorio/data

# Directorio para respaldos (opcional)
STOPS_BACKUP_DIR=/ruta/al/directorio/backups

# Respaldo automático (default: true)
STOPS_AUTO_BACKUP=true

# Hora del respaldo automático (default: 23:59)
STOPS_BACKUP_TIME=23:59
```

## Ventajas del Sistema por Año

1. **Mejor Organización**: Datos históricos separados por año
2. **Rendimiento**: Archivos más pequeños mejoran la velocidad de lectura/escritura
3. **Mantenimiento**: Más fácil hacer respaldos o archivar años antiguos
4. **Escalabilidad**: El sistema no se ralentiza con el tiempo
5. **Flexibilidad**: Puedes mover o archivar años antiguos sin afectar el año actual

## Ejemplo de Uso

```javascript
// Al registrar un paro con fecha 2025-12-23
// Se guardará automáticamente en: backend/data/paros_2025.csv

// Al registrar un paro con fecha 2026-01-15
// Se guardará automáticamente en: backend/data/paros_2026.csv

// Al consultar GET /api/paros
// Se devolverán los datos de AMBOS archivos combinados
```
