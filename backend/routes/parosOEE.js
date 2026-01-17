const express = require('express');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

module.exports = (stopsFilePath) => {
  const router = express.Router();

  // Función auxiliar para parsear una fecha en formato M/D/YYYY a Date
  const parseFecha = (fechaStr) => {
    if (!fechaStr) return null;
    const parts = String(fechaStr).split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
    return new Date(fechaStr);
  };

  // Función auxiliar para parsear una hora en formato HH:MM a minutos desde medianoche
  const parseHoraToMinutes = (horaStr) => {
    if (!horaStr) return 0;
    const parts = String(horaStr).split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      return hours * 60 + minutes;
    }
    return 0;
  };

  // Endpoint: Generar archivo Excel con paros asociados a batch ID de OEE
  router.get('/paros-oee-excel', async (req, res) => {
    try {
      console.log('📊 Iniciando generación de Excel paros-OEE...');

      // 1. Leer archivo de paros
      const parosPath = stopsFilePath || path.join(__dirname, '../data/paros.csv');
      if (!fs.existsSync(parosPath)) {
        return res.status(404).send('Archivo de paros no encontrado');
      }

      const parosRaw = fs.readFileSync(parosPath, 'utf8');
      const parosRows = parosRaw.split('\n').filter(r => r.trim() !== '');
      const parosHeader = parosRows[0].split(';');
      
      // Parsear paros
      const paros = [];
      for (let i = 1; i < parosRows.length; i++) {
        const cols = parosRows[i].split(';');
        if (cols.length < parosHeader.length) continue;
        
        const fecha = cols[0];
        const horaParo = cols[4];
        const horaArranque = cols[5];
        
        paros.push({
          fecha: fecha,
          area: cols[1],
          linea: cols[2],
          pn: cols[3],
          hora_paro: horaParo,
          hora_arranque: horaArranque,
          diferencia_minutos: parseInt(cols[6]) || 0,
          categoria: cols[7],
          estacion: cols[8],
          modo_falla: cols[9],
          descripcion_modo_falla: cols[10],
          descripcion: cols[11],
          paro_programado: cols[12],
          ajuste_proceso: cols[13]
        });
      }

      console.log(`✅ Paros cargados: ${paros.length} registros`);

      // 2. Leer archivo de OEE Cuts
      const oeePath = path.join(__dirname, '../data/EOL_Cuts_OEE.csv');
      if (!fs.existsSync(oeePath)) {
        return res.status(404).send('Archivo EOL_Cuts_OEE.csv no encontrado. Ejecuta primero /api/rea-production-eolo-cuts-oee');
      }

      const oeeRaw = fs.readFileSync(oeePath, 'utf8');
      const oeeRows = oeeRaw.split('\n').filter(r => r.trim() !== '');
      const oeeHeader = oeeRows[0].split(',');

      // Leer archivo EOL_Cuts.csv para obtener los batch IDs reales con sus rangos
      const eolCutsPath = path.join(__dirname, '../data/EOL_Cuts.csv');
      const batchRanges = []; // Array de { batchId, startDate, endDate }
      
      if (fs.existsSync(eolCutsPath)) {
        const eolCutsRaw = fs.readFileSync(eolCutsPath, 'utf8');
        const eolCutsRows = eolCutsRaw.split('\n').filter(r => r.trim() !== '');
        
        for (let i = 1; i < eolCutsRows.length; i++) {
          const line = eolCutsRows[i];
          const cols = [];
          let currentCol = '';
          let insideQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              cols.push(currentCol);
              currentCol = '';
            } else {
              currentCol += char;
            }
          }
          cols.push(currentCol);
          
          // Columnas: batchId(0), startFecha(1), startHora(2), startFechaHoraISO(3), endFecha(4), endHora(5), endFechaHoraISO(6)
          if (cols.length >= 7) {
            const batchId = cols[0];
            const startISOraw = cols[3]; // columna startFechaHoraISO
            const endISOraw = cols[6]; // columna endFechaHoraISO
            
            let startDate = new Date(startISOraw);
            let endDate = new Date(endISOraw);
            
            // Manejar formato "6:00:35 AM" convirtiéndolo a formato ISO válido
            if (isNaN(startDate) && startISOraw) {
              const parts = startISOraw.split('T');
              if (parts.length === 2 && (parts[1].includes('AM') || parts[1].includes('PM'))) {
                const datePart = parts[0];
                const timePart = parts[1].trim();
                const match = timePart.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
                if (match) {
                  let [, hours, minutes, seconds, ampm] = match;
                  hours = parseInt(hours);
                  if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                  if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                  startDate = new Date(`${datePart}T${String(hours).padStart(2,'0')}:${minutes}:${seconds}`);
                }
              }
            }
            
            if (isNaN(endDate) && endISOraw) {
              const parts = endISOraw.split('T');
              if (parts.length === 2 && (parts[1].includes('AM') || parts[1].includes('PM'))) {
                const datePart = parts[0];
                const timePart = parts[1].trim();
                const match = timePart.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
                if (match) {
                  let [, hours, minutes, seconds, ampm] = match;
                  hours = parseInt(hours);
                  if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                  if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                  endDate = new Date(`${datePart}T${String(hours).padStart(2,'0')}:${minutes}:${seconds}`);
                }
              }
            }
            
            if (!isNaN(startDate) && !isNaN(endDate)) {
              batchRanges.push({ batchId, startDate, endDate });
            }
          }
        }
      }
      
      console.log(`✅ Cargados ${batchRanges.length} batch ranges desde EOL_Cuts.csv`);

      // Parsear OEE batches
      const oeeBatches = [];
      for (let i = 1; i < oeeRows.length; i++) {
        const line = oeeRows[i];
        // Parsear CSV respetando comillas
        const cols = [];
        let currentCol = '';
        let insideQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            cols.push(currentCol);
            currentCol = '';
          } else {
            currentCol += char;
          }
        }
        cols.push(currentCol); // último campo

        if (cols.length < 10) continue;

        const startISO = cols[0];
        const endISO = cols[1];
        const pn = cols[2];
        const piezasTotales = parseInt(cols[3]) || 0;
        const durationMinutes = parseInt(cols[4]) || 0;

        // Buscar batch ID real comparando rangos de fechas
        const startDate = new Date(startISO);
        const endDate = new Date(endISO);
        let realBatchId = `BATCH_${i}`;
        
        for (const batch of batchRanges) {
          const startDiff = Math.abs(batch.startDate - startDate);
          const endDiff = Math.abs(batch.endDate - endDate);
          // Margen de 60 segundos para compensar diferencias de redondeo
          if (startDiff < 60000 && endDiff < 60000) {
            realBatchId = batch.batchId;
            break;
          }
        }

        oeeBatches.push({
          batchId: realBatchId,
          startISO: startISO,
          endISO: endISO,
          startDate: startDate,
          endDate: endDate,
          pn: pn,
          piezasTotales: piezasTotales,
          durationMinutes: durationMinutes,
          shiftTimeMinutes: parseInt(cols[5]) || 0,
          tiempoPlaneadoMinutes: parseInt(cols[6]) || 0,
          downtimeProgramadoMinutes: parseInt(cols[7]) || 0,
          downtimeNoProgramadoMinutes: parseInt(cols[8]) || 0,
          downtimeMinutes: parseInt(cols[9]) || 0,
          disponibilidad: parseFloat(cols[10]) || 0,
          eficiencia: parseFloat(cols[11]) || 0,
          calidad: parseFloat(cols[12]) || 0,
          eolOk: parseInt(cols[13]) || 0,
          eolNok: parseInt(cols[14]) || 0,
          changeOver: cols[15],
          stations_json: cols[16] || '[]'
        });
      }

      console.log(`✅ Batches OEE cargados: ${oeeBatches.length} registros`);

      // 3. Asociar cada paro a su batch correspondiente
      const parosConBatch = [];
      
      for (const paro of paros) {
        // Parsear fecha y hora del paro
        const fechaParo = parseFecha(paro.fecha);
        if (!fechaParo) continue;

        // Crear timestamp del paro (usar hora_paro como referencia)
        const [horasP, minutosP] = paro.hora_paro.split(':').map(x => parseInt(x) || 0);
        const fechaHoraParo = new Date(fechaParo);
        fechaHoraParo.setHours(horasP, minutosP, 0, 0);

        // Buscar batch que contenga este paro
        let batchEncontrado = null;
        for (const batch of oeeBatches) {
          if (fechaHoraParo >= batch.startDate && fechaHoraParo <= batch.endDate) {
            batchEncontrado = batch;
            break;
          }
        }

        parosConBatch.push({
          ...paro,
          batchId: batchEncontrado ? batchEncontrado.batchId : 'SIN_BATCH',
          batchStartISO: batchEncontrado ? batchEncontrado.startISO : '',
          batchEndISO: batchEncontrado ? batchEncontrado.endISO : '',
          batchPN: batchEncontrado ? batchEncontrado.pn : '',
          batchPiezasTotales: batchEncontrado ? batchEncontrado.piezasTotales : 0,
          batchDisponibilidad: batchEncontrado ? batchEncontrado.disponibilidad : 0,
          batchEficiencia: batchEncontrado ? batchEncontrado.eficiencia : 0,
          batchCalidad: batchEncontrado ? batchEncontrado.calidad : 0,
          batchOEE: batchEncontrado ? (batchEncontrado.disponibilidad * batchEncontrado.eficiencia * batchEncontrado.calidad * 100).toFixed(2) : 0
        });
      }

      console.log(`✅ Paros asociados a batches: ${parosConBatch.length} registros`);

      // 4. Crear archivo Excel con ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Paros con OEE');

      // Definir columnas
      worksheet.columns = [
        { header: 'Batch ID', key: 'batchId', width: 15 },
        { header: 'Batch Start', key: 'batchStartISO', width: 22 },
        { header: 'Batch End', key: 'batchEndISO', width: 22 },
        { header: 'Batch PN', key: 'batchPN', width: 30 },
        { header: 'Batch Piezas', key: 'batchPiezasTotales', width: 12 },
        { header: 'Batch OEE %', key: 'batchOEE', width: 12 },
        { header: 'Batch Disponibilidad', key: 'batchDisponibilidad', width: 18 },
        { header: 'Batch Eficiencia', key: 'batchEficiencia', width: 16 },
        { header: 'Batch Calidad', key: 'batchCalidad', width: 14 },
        { header: 'Fecha Paro', key: 'fecha', width: 12 },
        { header: 'Hora Paro', key: 'hora_paro', width: 10 },
        { header: 'Hora Arranque', key: 'hora_arranque', width: 12 },
        { header: 'Duración (min)', key: 'diferencia_minutos', width: 14 },
        { header: 'Área', key: 'area', width: 10 },
        { header: 'Línea', key: 'linea', width: 12 },
        { header: 'PN', key: 'pn', width: 25 },
        { header: 'Estación', key: 'estacion', width: 12 },
        { header: 'Categoría', key: 'categoria', width: 15 },
        { header: 'Modo Falla', key: 'modo_falla', width: 15 },
        { header: 'Descripción Modo Falla', key: 'descripcion_modo_falla', width: 25 },
        { header: 'Descripción', key: 'descripcion', width: 40 },
        { header: 'Paro Programado', key: 'paro_programado', width: 16 },
        { header: 'Ajuste Proceso', key: 'ajuste_proceso', width: 16 }
      ];

      // Estilo del encabezado
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Agregar datos
      parosConBatch.forEach(paro => {
        worksheet.addRow(paro);
      });

      // Aplicar formato alternado de filas
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' }
          };
        }
      });

      // Aplicar bordes a todas las celdas
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Auto-filtro
      worksheet.autoFilter = {
        from: 'A1',
        to: `W${parosConBatch.length + 1}`
      };

      // Generar buffer y enviarlo
      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Paros_OEE.xlsx');
      res.send(buffer);

      console.log('✅ Archivo Excel generado y enviado exitosamente');

    } catch (err) {
      console.error('❌ Error generando Excel paros-OEE:', err);
      res.status(500).send(`Error generando archivo Excel: ${err.message}`);
    }
  });

  // Endpoint alternativo: Devuelve JSON con paros y batch IDs
  router.get('/paros-oee-json', async (req, res) => {
    try {
      console.log('📊 Iniciando obtención de paros-OEE en JSON...');

      // 1. Leer archivo de paros
      const parosPath = stopsFilePath || path.join(__dirname, '../data/paros.csv');
      if (!fs.existsSync(parosPath)) {
        return res.status(404).send('Archivo de paros no encontrado');
      }

      const parosRaw = fs.readFileSync(parosPath, 'utf8');
      const parosRows = parosRaw.split('\n').filter(r => r.trim() !== '');
      const parosHeader = parosRows[0].split(';');
      
      // Parsear paros
      const paros = [];
      for (let i = 1; i < parosRows.length; i++) {
        const cols = parosRows[i].split(';');
        if (cols.length < parosHeader.length) continue;
        
        const fecha = cols[0];
        const horaParo = cols[4];
        const horaArranque = cols[5];
        
        paros.push({
          fecha: fecha,
          area: cols[1],
          linea: cols[2],
          pn: cols[3],
          hora_paro: horaParo,
          hora_arranque: horaArranque,
          diferencia_minutos: parseInt(cols[6]) || 0,
          categoria: cols[7],
          estacion: cols[8],
          modo_falla: cols[9],
          descripcion_modo_falla: cols[10],
          descripcion: cols[11],
          paro_programado: cols[12],
          ajuste_proceso: cols[13]
        });
      }

      // 2. Leer archivo de OEE Cuts
      const oeePath = path.join(__dirname, '../data/EOL_Cuts_OEE.csv');
      if (!fs.existsSync(oeePath)) {
        return res.status(404).send('Archivo EOL_Cuts_OEE.csv no encontrado. Ejecuta primero /api/rea-production-eolo-cuts-oee');
      }

      const oeeRaw = fs.readFileSync(oeePath, 'utf8');
      const oeeRows = oeeRaw.split('\n').filter(r => r.trim() !== '');

      // Leer archivo EOL_Cuts.csv para obtener los batch IDs reales con rangos
      const eolCutsPath = path.join(__dirname, '../data/EOL_Cuts.csv');
      const batchRangesJson = [];
      
      if (fs.existsSync(eolCutsPath)) {
        const eolCutsRaw = fs.readFileSync(eolCutsPath, 'utf8');
        const eolCutsRows = eolCutsRaw.split('\n').filter(r => r.trim() !== '');
        
        for (let i = 1; i < eolCutsRows.length; i++) {
          const line = eolCutsRows[i];
          const cols = [];
          let currentCol = '';
          let insideQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              cols.push(currentCol);
              currentCol = '';
            } else {
              currentCol += char;
            }
          }
          cols.push(currentCol);
          
          if (cols.length >= 7) {
            const batchId = cols[0];
            const startISOraw = cols[3];
            const endISOraw = cols[6];
            
            let startDate = new Date(startISOraw);
            let endDate = new Date(endISOraw);
            
            // Manejar formato AM/PM
            if (isNaN(startDate) && startISOraw) {
              const parts = startISOraw.split('T');
              if (parts.length === 2 && (parts[1].includes('AM') || parts[1].includes('PM'))) {
                const datePart = parts[0];
                const timePart = parts[1].trim();
                const match = timePart.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
                if (match) {
                  let [, hours, minutes, seconds, ampm] = match;
                  hours = parseInt(hours);
                  if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                  if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                  startDate = new Date(`${datePart}T${String(hours).padStart(2,'0')}:${minutes}:${seconds}`);
                }
              }
            }
            
            if (isNaN(endDate) && endISOraw) {
              const parts = endISOraw.split('T');
              if (parts.length === 2 && (parts[1].includes('AM') || parts[1].includes('PM'))) {
                const datePart = parts[0];
                const timePart = parts[1].trim();
                const match = timePart.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
                if (match) {
                  let [, hours, minutes, seconds, ampm] = match;
                  hours = parseInt(hours);
                  if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                  if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                  endDate = new Date(`${datePart}T${String(hours).padStart(2,'0')}:${minutes}:${seconds}`);
                }
              }
            }
            
            if (!isNaN(startDate) && !isNaN(endDate)) {
              batchRangesJson.push({ batchId, startDate, endDate });
            }
          }
        }
      }

      // Parsear OEE batches
      const oeeBatches = [];
      for (let i = 1; i < oeeRows.length; i++) {
        const line = oeeRows[i];
        // Parsear CSV respetando comillas
        const cols = [];
        let currentCol = '';
        let insideQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            cols.push(currentCol);
            currentCol = '';
          } else {
            currentCol += char;
          }
        }
        cols.push(currentCol);

        if (cols.length < 10) continue;

        const startISO = cols[0];
        const endISO = cols[1];
        const pn = cols[2];

        // Buscar batch ID real usando rangos
        const startDate = new Date(startISO);
        const endDate = new Date(endISO);
        let realBatchId = `BATCH_${i}`;
        
        for (const batch of batchRangesJson) {
          const startDiff = Math.abs(batch.startDate - startDate);
          const endDiff = Math.abs(batch.endDate - endDate);
          if (startDiff < 60000 && endDiff < 60000) {
            realBatchId = batch.batchId;
            break;
          }
        }

        oeeBatches.push({
          batchId: realBatchId,
          startISO: startISO,
          endISO: endISO,
          startDate: startDate,
          endDate: endDate,
          pn: pn,
          piezasTotales: parseInt(cols[3]) || 0,
          durationMinutes: parseInt(cols[4]) || 0,
          disponibilidad: parseFloat(cols[10]) || 0,
          eficiencia: parseFloat(cols[11]) || 0,
          calidad: parseFloat(cols[12]) || 0,
          oee: (parseFloat(cols[10]) * parseFloat(cols[11]) * parseFloat(cols[12]) * 100).toFixed(2)
        });
      }

      // 3. Asociar cada paro a su batch correspondiente
      const parosConBatch = [];
      
      for (const paro of paros) {
        const fechaParo = parseFecha(paro.fecha);
        if (!fechaParo) continue;

        const [horasP, minutosP] = paro.hora_paro.split(':').map(x => parseInt(x) || 0);
        const fechaHoraParo = new Date(fechaParo);
        fechaHoraParo.setHours(horasP, minutosP, 0, 0);

        let batchEncontrado = null;
        for (const batch of oeeBatches) {
          if (fechaHoraParo >= batch.startDate && fechaHoraParo <= batch.endDate) {
            batchEncontrado = batch;
            break;
          }
        }

        parosConBatch.push({
          ...paro,
          batchInfo: batchEncontrado ? {
            batchId: batchEncontrado.batchId,
            startISO: batchEncontrado.startISO,
            endISO: batchEncontrado.endISO,
            pn: batchEncontrado.pn,
            piezasTotales: batchEncontrado.piezasTotales,
            oee: batchEncontrado.oee,
            disponibilidad: batchEncontrado.disponibilidad,
            eficiencia: batchEncontrado.eficiencia,
            calidad: batchEncontrado.calidad
          } : null
        });
      }

      res.json({ 
        total: parosConBatch.length,
        paros: parosConBatch 
      });

    } catch (err) {
      console.error('❌ Error obteniendo paros-OEE JSON:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
