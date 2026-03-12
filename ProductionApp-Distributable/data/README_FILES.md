# Archivos de Datos - Sistema de Producción

## Archivo Fuente Principal

### ProductionReport (múltiples versiones)
El sistema puede trabajar con diferentes archivos ProductionReport:

1. **ProductionReport.csv** - Versión genérica/copiada
2. **ProductionReport_YYYY-MM-DD_HH-MM-SS.csv** - Versión con timestamp específico

### Configuración
El archivo fuente se configura mediante la variable de entorno `REA_SOURCE_FILE_PATH` en el archivo `.env`:

```env
REA_SOURCE_FILE_PATH=C:/Users/salid/ProductionApp/backend/data/ProductionReport_2026-01-13_00-04-09.csv
```

**Si no se especifica `REA_SOURCE_FILE_PATH`:**
- El script `generate_eol_cuts.js` buscará automáticamente el archivo ProductionReport más reciente
- Los endpoints buscarán `ProductionReport.csv` en la carpeta data/

## Archivos Generados Automáticamente

### EOL_Cuts.csv
Generado por: `scripts/generate_eol_cuts.js`
- Contiene los cortes de producción basados en resets del contador EOL
- Se genera automáticamente al iniciar el servidor (si `AUTO_GENERATE_EOL=true`)
- Incluye: fecha/hora inicio/fin, PN, piezas totales, información de estaciones

### EOL_Cuts_OEE.csv
Generado por: `scripts/generate_eol_cuts.js`
- Versión enriquecida de EOL_Cuts.csv con métricas de OEE
- Incluye: Disponibilidad, Eficiencia, Calidad, EOL OK/NOK, Change Over
- También se actualiza cuando se llama al endpoint `/rea-production-eolo-cuts-oee`

### HrperHrReport.csv
Generado por: endpoint `/rea-production-create-hrperhr`
- Contiene diferencias hora por hora de producción por estación

## Flujo de Datos

```
1. Archivo Fuente (REA_SOURCE_FILE_PATH)
   └─> ProductionReport_2026-01-13_00-04-09.csv
       |
       ├─> scripts/generate_eol_cuts.js
       |   ├─> EOL_Cuts.csv
       |   └─> EOL_Cuts_OEE.csv
       |
       └─> Endpoints API
           ├─> /rea-production
           ├─> /rea-production-eolo-cuts-oee
           └─> /rea-production-create-hrperhr
```

## Consistencia de Datos

**IMPORTANTE:** Para asegurar que todos los procesos usen los mismos datos:

1. Configura `REA_SOURCE_FILE_PATH` en tu archivo `.env`
2. Apunta al archivo ProductionReport que deseas usar
3. Reinicia el servidor backend para regenerar los archivos EOL_Cuts

### Ejemplo de configuración:

```bash
# En backend/.env
REA_SOURCE_FILE_PATH=C:/Users/salid/ProductionApp/backend/data/ProductionReport_2026-01-13_00-04-09.csv
AUTO_GENERATE_EOL=true
DEFAULT_RATE_PER_HOUR=154
```

## Otros Archivos de Datos

- **paros.csv / paros_YYYY.csv** - Registro de paros/stops de producción
- **produccion.csv** - Datos de producción adicionales
- **efficiency.csv** - Datos de eficiencia
- **categories.json** - Categorías de paros
- **options.json** - Opciones de configuración
- **shifts.json** - Configuración de turnos

## Respaldos

Los respaldos automáticos se guardan en:
- `paros_backup/` - Respaldos de archivos de paros
- Configurables via `STOPS_BACKUP_DIR` y `PRODUCTION_BACKUP_DIR`
