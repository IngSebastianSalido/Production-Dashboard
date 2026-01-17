# API de Paros con OEE

Esta nueva funcionalidad asocia los paros de línea con los batch IDs de OEE calculados en la página de OEE.

## Endpoints Disponibles

### 1. Generar Excel con Paros y OEE

**GET** `/api/paros-oee-excel`

Genera y descarga un archivo Excel con todos los paros asociados a sus correspondientes batch IDs de OEE.

**Ejemplo de uso:**
```
http://localhost:3000/api/paros-oee-excel
```

El archivo generado incluye las siguientes columnas:

#### Información del Batch OEE:
- **Batch ID**: Identificador único del batch (BATCH_1, BATCH_2, etc.)
- **Batch Start**: Fecha y hora de inicio del batch (ISO format)
- **Batch End**: Fecha y hora de fin del batch (ISO format)
- **Batch PN**: Part Number del batch
- **Batch Piezas**: Total de piezas producidas en el batch
- **Batch OEE %**: OEE calculado como porcentaje (Disponibilidad × Eficiencia × Calidad × 100)
- **Batch Disponibilidad**: Métrica de disponibilidad del batch
- **Batch Eficiencia**: Métrica de eficiencia del batch
- **Batch Calidad**: Métrica de calidad del batch

#### Información del Paro:
- **Fecha Paro**: Fecha del paro
- **Hora Paro**: Hora de inicio del paro
- **Hora Arranque**: Hora de arranque después del paro
- **Duración (min)**: Duración del paro en minutos
- **Área**: Área donde ocurrió el paro
- **Línea**: Línea de producción
- **PN**: Part Number del producto
- **Estación**: Estación donde ocurrió el paro
- **Categoría**: Categoría del paro
- **Modo Falla**: Modo de falla
- **Descripción Modo Falla**: Descripción detallada del modo de falla
- **Descripción**: Descripción del paro
- **Paro Programado**: Indica si el paro fue programado (si/no)
- **Ajuste Proceso**: Indica si fue un ajuste de proceso (si/no)

**Características del archivo Excel:**
- Encabezado con fondo azul y texto en blanco
- Filas alternadas con fondo gris claro para mejor legibilidad
- Bordes en todas las celdas
- Auto-filtro habilitado en todas las columnas
- Nombre del archivo: `Paros_OEE.xlsx`

---

### 2. Obtener JSON con Paros y OEE

**GET** `/api/paros-oee-json`

Devuelve un JSON con todos los paros asociados a sus batch IDs de OEE.

**Ejemplo de uso:**
```
http://localhost:3000/api/paros-oee-json
```

**Respuesta:**
```json
{
  "total": 1234,
  "paros": [
    {
      "fecha": "3/10/2025",
      "area": "REA",
      "linea": "Actuadores",
      "pn": "3140CA029",
      "hora_paro": "14:59",
      "hora_arranque": "15:01",
      "diferencia_minutos": 2,
      "categoria": "Producción",
      "estacion": "REA",
      "modo_falla": "General",
      "descripcion_modo_falla": "TBD",
      "descripcion": "Cambio de turno",
      "paro_programado": "si",
      "ajuste_proceso": "no",
      "batchInfo": {
        "batchId": "BATCH_5",
        "startISO": "2025-09-23T14:00:00.000Z",
        "endISO": "2025-09-23T22:00:00.000Z",
        "pn": "WG REA STELLANTIS CA028",
        "piezasTotales": 521,
        "oee": "0.00",
        "disponibilidad": 0.0000,
        "eficiencia": 0.3618,
        "calidad": 0.9905
      }
    }
  ]
}
```

**Nota:** Si un paro no coincide con ningún batch OEE, el campo `batchInfo` será `null`.

---

## Prerequisitos

Antes de usar estos endpoints, asegúrate de que:

1. El archivo `EOL_Cuts_OEE.csv` esté generado. Este archivo se crea automáticamente al llamar al endpoint:
   ```
   GET /api/rea-production-eolo-cuts-oee
   ```

2. El archivo `paros.csv` contenga los registros de paros.

---

## Lógica de Asociación

La asociación entre paros y batches OEE se realiza mediante comparación de timestamps:

1. Se parsea la fecha y hora de inicio del paro
2. Se busca el batch OEE cuyo rango de tiempo (startISO - endISO) contenga el timestamp del paro
3. Si se encuentra una coincidencia, se asocia toda la información del batch al paro
4. Si no hay coincidencia, el paro queda marcado como `SIN_BATCH` o con `batchInfo: null`

---

## Casos de Uso

### Análisis de Impacto de Paros en OEE
Usando el archivo Excel generado, puedes:
- Filtrar paros por batch ID para ver todos los paros que afectaron un batch específico
- Analizar la relación entre la duración de paros y el OEE resultante
- Identificar patrones de paros en batches con bajo OEE

### Reportes Ejecutivos
- Exportar datos consolidados de paros y OEE para presentaciones
- Generar métricas de disponibilidad vs paros programados
- Analizar eficiencia de resolución de paros por estación

### Análisis Temporal
- Agrupar paros por batch y calcular tiempo total de downtime
- Comparar batches similares (mismo PN) y sus paros asociados
- Identificar batches con mayor frecuencia de paros

---

## Solución de Problemas

### Error: "Archivo EOL_Cuts_OEE.csv no encontrado"
**Solución:** Primero ejecuta el endpoint que genera este archivo:
```
GET /api/rea-production-eolo-cuts-oee
```

### Error: "Archivo de paros no encontrado"
**Solución:** Verifica que el archivo `backend/data/paros.csv` exista y contenga datos.

### Paros sin Batch Asociado
**Causa:** El paro ocurrió en un momento que no coincide con ningún batch OEE registrado.
**Posibles razones:**
- El paro es muy antiguo o muy reciente comparado con los batches OEE disponibles
- Hay un desfase de tiempo entre los sistemas de registro
- El paro fue registrado con una fecha/hora incorrecta

---

## Ejemplo de Flujo de Trabajo

1. **Generar datos OEE:**
   ```
   GET http://localhost:3000/api/rea-production-eolo-cuts-oee
   ```

2. **Descargar Excel con paros asociados:**
   ```
   GET http://localhost:3000/api/paros-oee-excel
   ```

3. **Abrir el archivo Excel descargado y analizar:**
   - Usar filtros para ver paros de un batch específico
   - Ordenar por duración de paros
   - Identificar patrones por estación o categoría

---

## Formato de Fechas

- **Paros CSV:** Formato M/D/YYYY (ejemplo: 3/10/2025)
- **OEE CSV:** Formato ISO 8601 (ejemplo: 2025-09-23T14:00:00.000Z)
- La conversión entre formatos se realiza automáticamente

---

## Próximas Mejoras

Posibles funcionalidades futuras:
- Filtrado por rango de fechas
- Agrupación de paros por batch en el JSON response
- Cálculo de métricas agregadas por batch
- Gráficas de correlación paros-OEE
- Exportar a otros formatos (PDF, CSV)
