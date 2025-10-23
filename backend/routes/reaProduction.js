const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

// ⚙️ Variables
const reaSourceFilePath = process.env.REA_SOURCE_FILE_PATH; // Archivo original de producción
const reaFilePath = path.resolve(__dirname, '../data/ProductionReport.csv'); // Destino en la carpeta data
const outputCsvPath = path.join(__dirname, '../data/HrperHrReport.csv'); // CSV de diferencias

// 🚀 Copiar ProductionReport y mostrar datos de REA
router.get('/rea-production', (req, res) => {
  if (!reaSourceFilePath) {
    console.error('No se encontró REA_SOURCE_FILE_PATH en .env');
    return res.status(500).send('No está configurado REA_SOURCE_FILE_PATH.');
  }

  fs.copyFile(reaSourceFilePath, reaFilePath, (copyErr) => {
    if (copyErr) {
      console.error('Error al copiar ProductionReport:', copyErr);
      return res.status(500).send('Error al copiar el archivo ProductionReport.');
    }

    console.log('✅ Archivo ProductionReport copiado correctamente.');

    fs.readFile(reaFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error leyendo ProductionReport:', err);
        return res.status(500).send('Error leyendo el archivo ProductionReport.');
      }

      const rows = data.split('\n').filter(row => row.trim() !== '');
      const header = rows[0].split(';');
      const dataRows = rows.slice(Math.max(rows.length - 1, 1)); // Solo la cabecera si hay pocas filas

      const resultados = [];

      for (const row of dataRows) {
        const columns = row.split(';');
        const fecha = columns[0];
        const hora = columns[1];
        const pn = columns[2]; // Agregar número de parte

        const estaciones = [];

        for (let i = 3; i < columns.length; i += 2) {
          const station = header[i]?.replace(/ok$/i, '') || `Estacion${i}`;
          const ok = parseInt(columns[i]) || 0;
          const nok = parseInt(columns[i + 1]) || 0;

          estaciones.push({
            station,
            ok,
            nok,
            percent: (ok + nok) ? (ok / (ok + nok)) * 100 : 0,
          });
        }

        resultados.push({ fecha, hora, pn, estaciones });
      }

      res.json(resultados);
    });
  });
});

// 🚀 Crear HrperHrReport automáticamente basado en ProductionReport
router.get('/rea-production-eolo', (req, res) => {
  if (!reaSourceFilePath) {
    console.error('No se encontró REA_SOURCE_FILE_PATH en .env');
    return res.status(500).send('No está configurado REA_SOURCE_FILE_PATH.');
  }

  fs.copyFile(reaSourceFilePath, reaFilePath, (copyErr) => {
    if (copyErr) {
      console.error('Error al copiar ProductionReport:', copyErr);
      return res.status(500).send('Error al copiar ProductionReport.');
    }

    console.log('✅ ProductionReport copiado.');

    fs.readFile(reaFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error leyendo ProductionReport:', err);
        return res.status(500).send('Error leyendo ProductionReport.');
      }

  const rows = data.split('\n').filter(row => row.trim() !== '');
  const header = rows[0].split(';');
  // By default process the entire file. If REA_MAX_ROWS is set (env) and > 0,
  // only keep the last REA_MAX_ROWS rows to limit memory/CPU for very large files.
  const maxRows = parseInt(process.env.REA_MAX_ROWS || '0', 10) || 0;
  const dataRows = maxRows > 0 ? rows.slice(-maxRows) : rows.slice(1);

      const eoloIndex = header.findIndex(col => col.toLowerCase().includes('eolok'));

      if (eoloIndex === -1) {
        console.error('No se encontró la columna EOLOk.');
        return res.status(500).send('No se encontró la columna EOLOk.');
      }

      const registros = [];

      for (const row of dataRows) {
        const columns = row.split(';');
        const rowFecha = columns[0];
        const rowHora = columns[1];

        if (!rowFecha || !rowHora) continue;

        const cleanHora = rowHora.replace('a. m.', 'AM').replace('p. m.', 'PM').trim();
        const fechaHoraString = `${rowFecha} ${cleanHora}`;
        const fechaHoraObj = new Date(fechaHoraString);

        if (isNaN(fechaHoraObj)) continue;

        const horaCompleta = fechaHoraObj.toTimeString().split(' ')[0];
        const eolOk = parseInt(columns[eoloIndex]) || 0;

        registros.push({
          fecha: rowFecha,
          horaCompleta,
          piezasAcumuladas: eolOk,
          fechaHoraReal: fechaHoraObj
        });
      }

      registros.sort((a, b) => a.fechaHoraReal - b.fechaHoraReal);

      const diferencias = [];
      let acumuladoAnterior = 0;

      for (const actual of registros) {
        let diferencia = 0;

        if (actual.piezasAcumuladas !== 0) {
          if (actual.piezasAcumuladas >= acumuladoAnterior) {
            diferencia = actual.piezasAcumuladas - acumuladoAnterior;
          } else {
            diferencia = actual.piezasAcumuladas;
          }
          acumuladoAnterior = actual.piezasAcumuladas;
        }

        diferencias.push({
          fecha: actual.fecha,
          hora: actual.horaCompleta,
          piezasProducidas: diferencia
        });
      }

      const csvHeader = 'Fecha,Hora,PiezasProducidas\n';
      const csvContent = diferencias.map(dif => `${dif.fecha},${dif.hora},${dif.piezasProducidas}`).join('\n');
      const fullCsv = csvHeader + csvContent;

      fs.writeFile(outputCsvPath, fullCsv, 'utf8', (err) => {
        if (err) {
          console.error('Error escribiendo HrperHrReport:', err);
          return res.status(500).send('Error escribiendo HrperHrReport.csv.');
        }

        console.log('✅ HrperHrReport.csv generado correctamente.');
        res.json({ message: 'HrperHrReport.csv generado exitosamente.' });
      });
    });
  });
});


//  Leer HrperHrReport para gráficas (siempre actualizar)
router.get('/rea-production-eolo-graph', async (req, res) => {
    const { fecha } = req.query;
  
    if (!fecha) {
      return res.status(400).send('Se requiere el parámetro fecha en formato YYYY-MM-DD.');
    }
  
    try {
      //  Siempre regenerar HrperHrReport.csv, no importa si existe
      await new Promise((resolve, reject) => {
        fs.readFile(reaSourceFilePath, 'utf8', (err, data) => {
          if (err) return reject('Error leyendo ProductionReport original.');
  
          const rows = data.split('\n').filter(row => row.trim() !== '');
          const header = rows[0].split(';');
          const maxRows = parseInt(process.env.REA_MAX_ROWS || '0', 10) || 0;
          const dataRows = maxRows > 0 ? rows.slice(-maxRows) : rows.slice(1);
  
          const eoloIndex = header.findIndex(col => col.toLowerCase().includes('eolok'));
          if (eoloIndex === -1) return reject('No se encontró columna EOLOk.');
  
          const registros = [];
          for (const row of dataRows) {
            const columns = row.split(';');
            const rowFecha = columns[0];
            const rowHora = columns[1];
  
            if (!rowFecha || !rowHora) continue;
  
            const cleanHora = rowHora.replace('a. m.', 'AM').replace('p. m.', 'PM').trim();
            const fechaHoraString = `${rowFecha} ${cleanHora}`;
            const fechaHoraObj = new Date(fechaHoraString);
  
            if (isNaN(fechaHoraObj)) continue;
  
            const horaCompleta = fechaHoraObj.toTimeString().split(' ')[0];
            const eolOk = parseInt(columns[eoloIndex]) || 0;
  
            registros.push({ fecha: rowFecha, horaCompleta, piezasAcumuladas: eolOk, fechaHoraReal: fechaHoraObj });
          }
  
          registros.sort((a, b) => a.fechaHoraReal - b.fechaHoraReal);
  
          const diferencias = [];
          let acumuladoAnterior = 0;
          for (let i = 0; i < registros.length; i++) {
            const actual = registros[i];
            let diferencia = 0;
            if (actual.piezasAcumuladas === 0) {
              diferencia = 0;
            } else {
              diferencia = actual.piezasAcumuladas >= acumuladoAnterior
                ? actual.piezasAcumuladas - acumuladoAnterior
                : actual.piezasAcumuladas;
              acumuladoAnterior = actual.piezasAcumuladas;
            }
            diferencias.push({
              fecha: actual.fecha,
              hora: actual.horaCompleta,
              piezasProducidas: diferencia
            });
          }
  
          const csvHeader = 'Fecha,Hora,PiezasProducidas\n';
          const csvContent = diferencias.map(dif => `${dif.fecha},${dif.hora},${dif.piezasProducidas}`).join('\n');
          const fullCsv = csvHeader + csvContent;
  
          fs.writeFile(outputCsvPath, fullCsv, 'utf8', (err) => {
            if (err) return reject('Error escribiendo HrperHrReport.');
            resolve(); // ✅
          });
        });
      });
  
      // Ahora leer HrperHrReport.csv actualizado
      const data = fs.readFileSync(outputCsvPath, 'utf8');
      const rows = data.split('\n').filter(row => row.trim() !== '');
      const header = rows[0].split(',');
      const dataRows = rows.slice(1);
  
      const registros = [];
      // Se define el rango de 7am a 7am del siguiente día
      const startDate = new Date(`${fecha}T07:00:00`);
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  
      for (const row of rows.slice(1)) {
        const columns = row.split(',');
        const fechaRow = columns[0].trim();
        const horaCompleta = columns[1].trim();
        const piezasProducidas = parseInt(columns[2]) || 0;
  
        // Convertir "M/D/YYYY" a "YYYY-MM-DD"
        const parts = fechaRow.split('/');
        if (parts.length === 3) {
          const formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          const rowDate = new Date(`${formattedDate}T${horaCompleta}`);

          if (rowDate >= startDate && rowDate < endDate) {
            // Guardar la hora completa con minutos para cálculos de turnos
            registros.push({ 
              hora: rowDate.getHours().toString().padStart(2, '0') + ':00',
              horaExacta: horaCompleta, // Hora completa con minutos
              piezasProducidas 
            });
          }
        } else {
          console.log(`DEBUG: fechaRow formato inválido: ${fechaRow} for row: ${row}`);
        }
      }
      
      // Agrupar las piezas producidas por hora
      const datosPorHora = {};
      for (const registro of registros) {
        const key = registro.hora;
        if (!datosPorHora[key]) datosPorHora[key] = 0;
        datosPorHora[key] += registro.piezasProducidas;
      }
  
      // Generar 24 entradas una por cada hora desde startDate (7am) hasta 7am del día siguiente
      const datosOrdenados = [];
      for (let i = 0; i < 24; i++) {
        const currentDate = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const hourStr = currentDate.getHours().toString().padStart(2, '0') + ':00';
        datosOrdenados.push({
           hora: hourStr,
           piezasProducidas: datosPorHora[hourStr] || 0
        });
      }
      
      // Calcular totales de turnos usando la hora exacta (con minutos)
      // Turno 1: de 7:00 a 15:00 (horas 07:00 a 14:59)
      // Turno 2: de 15:00 a 22:30 (horas 15:00 a 22:29)
      // Turno 3: de 22:30 a 7:00 (horas 22:30 a 06:59 del día siguiente)
      let turno1 = 0, turno2 = 0, turno3 = 0;

      for (const registro of registros) {
        const horaExacta = registro.horaExacta;
        const [hourStr, minuteStr] = horaExacta.split(':');
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        if (hour >= 7 && hour < 15) {
          // Turno 1: 07:00 - 14:59
          turno1 += registro.piezasProducidas;
        } else if ((hour === 15 && minute >= 0) || (hour > 15 && hour < 22) || (hour === 22 && minute < 30)) {
          // Turno 2: 15:00 - 22:29
          turno2 += registro.piezasProducidas;
        } else if ((hour === 22 && minute >= 30) || hour > 22 || hour < 7) {
          // Turno 3: 22:30 - 06:59
          turno3 += registro.piezasProducidas;
        }
      }

      res.json({ datos: datosOrdenados, turnos: { turno1, turno2, turno3 } });
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Error procesando la gráfica.');
    }
  });
  
// Endpoint: Obtener deltas por timestamp (cortes) basado en la columna EOL (EOLOk)
// Devuelve un array de { fecha, hora, pn, piezasProducidas, piezasAcumuladas, estaciones }
router.get('/rea-production-eolo-deltas', async (req, res) => {
  try {
    const { from, to } = req.query; // opcional: filtrar por rango YYYY-MM-DD

    if (!reaSourceFilePath) {
      return res.status(500).send('No está configurado REA_SOURCE_FILE_PATH.');
    }

  const raw = require('fs').readFileSync(reaSourceFilePath, 'utf8');
  const rows = raw.split('\n').filter(row => row.trim() !== '');
  const header = rows[0].split(';');
  const maxRows = parseInt(process.env.REA_MAX_ROWS || '0', 10) || 0;
  const dataRows = maxRows > 0 ? rows.slice(-maxRows) : rows.slice(1);

    const eoloIndex = header.findIndex(col => col.toLowerCase().includes('eolok'));
    if (eoloIndex === -1) {
      return res.status(500).send('No se encontró columna EOLOk.');
    }

    // construir registros válidos, ignorando filas donde todas las columnas de máquinas son 0
    const registros = [];
    for (const row of dataRows) {
      const columns = row.split(';');
      const rowFecha = columns[0];
      const rowHora = columns[1];
      if (!rowFecha || !rowHora) continue;

      // verificar si todas las columnas de máquinas (pares ok/nok) están a 0 -> posible glitch
      let anyNonZero = false;
      for (let i = 3; i < columns.length; i += 2) {
        const ok = parseInt(columns[i]) || 0;
        const nok = parseInt(columns[i + 1]) || 0;
        if ((ok + nok) > 0) { anyNonZero = true; break; }
      }
      if (!anyNonZero) continue; // saltar filas con todos ceros

      const cleanHora = rowHora.replace('a. m.', 'AM').replace('p. m.', 'PM').trim();
      const fechaHoraString = `${rowFecha} ${cleanHora}`;
      const fechaHoraObj = new Date(fechaHoraString);
      if (isNaN(fechaHoraObj)) continue;

      const horaCompleta = fechaHoraObj.toTimeString().split(' ')[0];
      const eolOk = parseInt(columns[eoloIndex]) || 0;
      const pn = columns[2] || '';

      registros.push({ fecha: rowFecha, horaCompleta, piezasAcumuladas: eolOk, fechaHoraReal: fechaHoraObj, estacionesRaw: columns, pn });
    }

    // ordenar y calcular diferencias manejando reinicios
    registros.sort((a, b) => a.fechaHoraReal - b.fechaHoraReal);

    const diferencias = [];
    let acumuladoAnterior = 0;

    for (const actual of registros) {
      let diferencia = 0;
      if (actual.piezasAcumuladas !== 0) {
        if (actual.piezasAcumuladas >= acumuladoAnterior) {
          diferencia = actual.piezasAcumuladas - acumuladoAnterior;
        } else {
          // reinicio detectado -> tomar valor actual como produccion desde 0
          diferencia = actual.piezasAcumuladas;
        }
        acumuladoAnterior = actual.piezasAcumuladas;
      }

      // reconstruir estaciones con pares ok/nok a partir del header
      const estaciones = [];
      for (let i = 3; i < actual.estacionesRaw.length; i += 2) {
        const stationName = (header[i] || `Estacion${i}`).replace(/ok$/i, '');
        const okVal = parseInt(actual.estacionesRaw[i]) || 0;
        const nokVal = parseInt(actual.estacionesRaw[i + 1]) || 0;
        estaciones.push({ station: stationName, ok: okVal, nok: nokVal });
      }

      diferencias.push({
        fecha: actual.fecha,
        hora: actual.horaCompleta,
        pn: actual.pn,
        piezasProducidas: diferencia,
        piezasAcumuladas: actual.piezasAcumuladas,
        estaciones
      });
    }

    // Si hay filtro from/to, aplicarlo
    if (from && to) {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T23:59:59`);
      const filtered = diferencias.filter(d => {
        const parts = d.fecha.split('/');
        // intentar convertir formatos M/D/YYYY -> YYYY-MM-DD
        let dt;
        if (parts.length === 3) {
          dt = new Date(`${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}T00:00:00`);
        } else {
          dt = new Date(d.fecha);
        }
        return dt >= fromDate && dt <= toDate;
      });
      return res.json({ deltas: filtered });
    }

    res.json({ deltas: diferencias });
  } catch (err) {
    console.error('Error en /rea-production-eolo-deltas:', err);
    res.status(500).send('Error procesando deltas EOL');
  }
});

// Endpoint: Agrupar deltas en cortes (resets) detectados por disminución en EOLOk
// Devuelve array de cuts: { startFecha, startHora, endFecha, endHora, pn, piezasTotales, estaciones: [{station, ok, nok}], startAccum, endAccum }
router.get('/rea-production-eolo-cuts', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!reaSourceFilePath) return res.status(500).send('No está configurado REA_SOURCE_FILE_PATH.');

  const raw = fs.readFileSync(reaSourceFilePath, 'utf8');
  const rows = raw.split('\n').filter(r => r.trim() !== '');
  const header = rows[0].split(';');
  const maxRows = parseInt(process.env.REA_MAX_ROWS || '0', 10) || 0;
  const dataRows = maxRows > 0 ? rows.slice(-maxRows) : rows.slice(1);
    const eoloIndex = header.findIndex(col => col.toLowerCase().includes('eolok'));
    if (eoloIndex === -1) return res.status(500).send('No se encontró columna EOLOk.');

    // Build registros, keeping rows even if all-zero (we'll remove isolated zero outliers later)
    const registros = [];
    for (const row of dataRows) {
      const cols = row.split(';');
      const rowFecha = cols[0];
      const rowHora = cols[1];
      if (!rowFecha || !rowHora) continue;
      const cleanHora = rowHora.replace('a. m.', 'AM').replace('p. m.', 'PM').trim();
      const fechaHoraObj = new Date(`${rowFecha} ${cleanHora}`);
      if (isNaN(fechaHoraObj)) continue;
      const pn = cols[2] || '';
      // detect if all machine columns are zero
      let anyNonZero = false;
      for (let i = 3; i < cols.length; i += 2) {
        if ((parseInt(cols[i]) || 0) + (parseInt(cols[i+1]) || 0) > 0) { anyNonZero = true; break; }
      }
      registros.push({ fecha: rowFecha, hora: cleanHora, fechaHoraReal: fechaHoraObj, acumulado: parseInt(cols[eoloIndex]) || 0, raw: cols, pn, anyNonZero });
    }

    // Sort registros chronologically first so neighbor checks are meaningful
    registros.sort((a,b) => a.fechaHoraReal - b.fechaHoraReal);

    // Remove isolated zero rows (outliers): if a row has anyNonZero==false but both neighbors have anyNonZero==true, drop it
    const keep = new Array(registros.length).fill(true);
    for (let i = 0; i < registros.length; i++) {
      if (!registros[i].anyNonZero) {
        const prev = registros[i-1];
        const next = registros[i+1];
        if (prev && next && prev.anyNonZero && next.anyNonZero) {
          keep[i] = false; // isolated zero row -> outlier
        }
      }
    }
    const filteredRegs = registros.filter((r, idx) => keep[idx]);

  // Compute per-registro deltas for EOL and per-station using filteredRegs
  const deltas = [];
  let prev = null;
  // minimum previous acumulado to consider a reset valid (avoid tiny noise)
  // can be overridden by query param minPrevAccum
  const MIN_PREVIOUS_ACCUM = parseInt(req.query.minPrevAccum) || 5; // default 5
    for (let i = 0; i < filteredRegs.length; i++) {
      const r = filteredRegs[i];
      let deltaEol = 0;
      if (!prev) {
        // First registro: do not count the whole accumulated value as production
        deltaEol = 0;
      } else {
        if (r.acumulado >= prev.acumulado) {
          deltaEol = r.acumulado - prev.acumulado;
        } else {
          // possible reset observed at this registro: consider it a valid reset only if prev.acumulado >= MIN_PREVIOUS_ACCUM
          if ((prev.acumulado || 0) >= MIN_PREVIOUS_ACCUM) {
            deltaEol = 0; // reset marker, close previous cut
            r._isReset = true; // mark for grouping
          } else {
            // small previous accum, ignore reset and treat as normal noise -> compute positive diff only
            const diff = r.acumulado - prev.acumulado;
            deltaEol = diff > 0 ? diff : 0;
          }
        }
      }

      // per-station deltas: only positive differences; if no prev then 0
      const stationDeltas = [];
      for (let j = 3; j < r.raw.length; j += 2) {
        const name = (header[j] || `Est${j}`).replace(/ok$/i,'');
        const ok = parseInt(r.raw[j]) || 0;
        const nok = parseInt(r.raw[j+1]) || 0;
        let dOk = 0;
        let dNok = 0;
        if (prev) {
          const prevOk = parseInt(prev.raw[j]) || 0;
          const prevNok = parseInt(prev.raw[j+1]) || 0;
          const diffOk = ok - prevOk;
          const diffNok = nok - prevNok;
          dOk = diffOk > 0 ? diffOk : 0;
          dNok = diffNok > 0 ? diffNok : 0;
        }
        stationDeltas.push({ station: name, ok: dOk, nok: dNok });
      }

      deltas.push({ index: i, fecha: r.fecha, hora: r.hora, fechaHoraReal: r.fechaHoraReal, acumulado: r.acumulado, deltaEol, stationDeltas, pn: r.pn, _isReset: r._isReset || false });
      prev = r;
    }

    // Group deltas into cuts: accumulate deltas until we encounter a registro marked as reset (_isReset)
    const cuts = [];
    let cutStartIdx = 0;
    let cutSum = 0;
    let cutStationSums = {};

    for (let k = 0; k < deltas.length; k++) {
      const d = deltas[k];
      // accumulate
      cutSum += d.deltaEol;
      // sum stations
      d.stationDeltas.forEach(sd => {
        if (!cutStationSums[sd.station]) cutStationSums[sd.station] = { ok: 0, nok: 0 };
        cutStationSums[sd.station].ok += sd.ok;
        cutStationSums[sd.station].nok += sd.nok;
      });

      // if this registro is marked as reset, close the cut at previous registro (k-1)
      if (d._isReset) {
        const startRec = deltas[cutStartIdx];
        const endRec = deltas[k-1] || deltas[cutStartIdx];
        const estacionesArr = Object.keys(cutStationSums).map(s => ({ station: s, ok: cutStationSums[s].ok, nok: cutStationSums[s].nok }));
        if (cutSum > 0) {
          cuts.push({
            startFecha: startRec.fecha,
            startHora: startRec.hora,
            endFecha: endRec.fecha,
            endHora: endRec.hora,
            pn: endRec.pn || startRec.pn,
            piezasTotales: cutSum,
            estaciones: estacionesArr,
            startAccum: startRec.acumulado,
            endAccum: endRec.acumulado
          });
        }
        // reset accumulators, next cut starts at current registro
        cutStartIdx = k;
        cutSum = 0;
        cutStationSums = {};
      }
    }

    // If last cut still has production, include it
    if (cutSum > 0) {
      const startRec = deltas[cutStartIdx];
      const endRec = deltas[deltas.length - 1];
      const estacionesArr = Object.keys(cutStationSums).map(s => ({ station: s, ok: cutStationSums[s].ok, nok: cutStationSums[s].nok }));
      cuts.push({
        startFecha: startRec.fecha,
        startHora: startRec.hora,
        endFecha: endRec.fecha,
        endHora: endRec.hora,
        pn: endRec.pn || startRec.pn,
        piezasTotales: cutSum,
        estaciones: estacionesArr,
        startAccum: startRec.acumulado,
        endAccum: endRec.acumulado
      });
    }

    // Before returning cuts, write a CSV into backend/data for debugging/export
    try {
      const csvPath = path.join(__dirname, '../data/EOL_Cuts.csv');
      const csvHeader = 'startFecha,startHora,startFechaHoraISO,endFecha,endHora,endFechaHoraISO,pn,piezasTotales,startAccum,endAccum,stations_json\n';
      let csvContent = csvHeader;
      if (cuts.length === 0) {
        // write only header
        fs.writeFileSync(csvPath, csvContent, 'utf8');
      } else {
        for (const c of cuts) {
          // build ISO datetimes: try to parse original M/D/YYYY strings, fallback to Date
          const startParts = String(c.startFecha).split('/');
          let startISO = '';
          if (startParts.length === 3) startISO = `${startParts[2]}-${startParts[0].padStart(2,'0')}-${startParts[1].padStart(2,'0')}T${c.startHora}`;
          else startISO = new Date(`${c.startFecha} ${c.startHora}`).toISOString();

          const endParts = String(c.endFecha).split('/');
          let endISO = '';
          if (endParts.length === 3) endISO = `${endParts[2]}-${endParts[0].padStart(2,'0')}-${endParts[1].padStart(2,'0')}T${c.endHora}`;
          else endISO = new Date(`${c.endFecha} ${c.endHora}`).toISOString();

          const stationsJson = JSON.stringify(c.estaciones || []);
          const row = `${c.startFecha},${c.startHora},${startISO},${c.endFecha},${c.endHora},${endISO},"${(c.pn||'').replace(/\"/g,'')}",${c.piezasTotales || 0},${c.startAccum || 0},${c.endAccum || 0},"${stationsJson.replace(/"/g,'""')}"\n`;
          csvContent += row;
        }
        fs.writeFileSync(csvPath, csvContent, 'utf8');
      }
    } catch (csvErr) {
      console.error('Error escribiendo EOL_Cuts.csv:', csvErr);
    }

    // Return cuts
    if (from && to) {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T23:59:59`);
      const filtered = cuts.filter(c => {
        const parts = String(c.endFecha).split('/');
        let dt;
        if (parts.length === 3) dt = new Date(`${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}T00:00:00`);
        else dt = new Date(c.endFecha);
        return dt >= fromDate && dt <= toDate;
      });
      return res.json({ cuts: filtered });
    }

    res.json({ cuts });
  } catch (err) {
    console.error('Error en /rea-production-eolo-cuts:', err);
    res.status(500).send('Error procesando cortes EOL');
  }
});

// Endpoint: devuelve cortes EOL enriquecidos con métricas OEE (disponibilidad, eficiencia, calidad)
router.get('/rea-production-eolo-cuts-oee', async (req, res) => {
  try {
    const csvPath = path.join(__dirname, '../data/EOL_Cuts.csv');
    if (!fs.existsSync(csvPath)) return res.status(404).send('EOL_Cuts.csv no encontrado. Genera primero los cortes.');

  // Resolve stops/paros file: prefer STOPS_FILE_PATH env, then backend/data/paros.csv if present, then backend/data/stops.csv
  const candidateEnv = process.env.STOPS_FILE_PATH ? path.resolve(process.env.STOPS_FILE_PATH) : null;
  const candidateParos = path.join(__dirname, '../data/paros.csv');
  const candidateStops = path.join(__dirname, '../data/stops.csv');
  let stopsPath = null;
  if (candidateEnv && fs.existsSync(candidateEnv)) stopsPath = candidateEnv;
  else if (fs.existsSync(candidateParos)) stopsPath = candidateParos;
  else stopsPath = candidateStops;
    const ratePerHour = parseFloat(req.query.ratePerHour) || 154; // piezas por hora

    const csvRaw = fs.readFileSync(csvPath, 'utf8');
    const rows = csvRaw.split('\n').filter(r => r.trim() !== '');
    const header = rows[0].split(',');
    const dataRows = rows.slice(1);

  // Read stops file and parse intervals. Inspect header to find description-like columns
    let stops = [];
    if (fs.existsSync(stopsPath)) {
      const stopsRaw = fs.readFileSync(stopsPath, 'utf8');
      const srows = stopsRaw.split('\n').filter(r => r.trim() !== '');
      if (srows.length > 0) {
        const headerCols = srows[0].split(';').map(h => String(h||'').trim().toLowerCase());
        const descIndices = [];
        // prefer explicit descriptive column names when present
        const preferred = ['descripcion_modo_falla','descripcion','modo_falla','motivo','observacion','observaciones','nota','notes','categoria','tipo','detalle'];
        for (const key of preferred) {
          const idx = headerCols.findIndex(h => h.includes(key));
          if (idx >= 0) descIndices.push(idx);
        }
        // if none found, fallback to common positions after basic columns
        if (descIndices.length === 0) {
          for (let i = 6; i <= Math.min(12, headerCols.length - 1); i++) descIndices.push(i);
        }

        for (const line of srows.slice(1)) {
          const cols = line.split(';');
          const fecha = (cols[0] || '').trim();
          const hora_paro = (cols[4] || '').trim();
          const hora_arranque = (cols[5] || '').trim();
          if (!fecha || !hora_paro || !hora_arranque) continue;

          // build concatenated description from discovered indices
          const descParts = [];
          for (const idx of descIndices) {
            if (cols[idx]) descParts.push(String(cols[idx]).trim());
          }
          const descripcion = descParts.join(' ').trim();

          // Normalize fecha: if contains '/', treat as M/D/YYYY else assume YYYY-MM-DD
          let fechaNorm = fecha;
          if (fecha.includes('/')) {
            const p = fecha.split('/');
            if (p.length === 3) fechaNorm = `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`;
          }
          let start = new Date(`${fechaNorm}T${hora_paro}:00`);
          let end = new Date(`${fechaNorm}T${hora_arranque}:00`);
          if (isNaN(start) || isNaN(end)) continue;
          // If the stop crosses midnight, assume the end is next day
          if (end.getTime() < start.getTime()) {
            end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          }
          stops.push({ start, end, descripcion });
        }
      }
    }

    // Prepare Change Over regex: allow override via env var for tuning without code changes
    // default includes common english/spanish forms and some variations
  // broaden default pattern to match many variants reported in paros.csv (spanish/english, small typos)
  const defaultPattern = '\\b(?:change\\s*over|changeover|cambio(?: de)?|cambioover|set\\s*up|setup|cambio\\s+de\\s+linea|cambio\\s+de\\s+modelo|cambio\\s+de\\s+cinta|cambio\\s+de\\s+jig|espera\\s+liberacion|esperando\\s+liberacion|espera\\s+liberaci[oó]n|cambio\\s+de\\s*pieza|cambio\\s+de\\s+pieza|cambio\\s+de\\s+modelo|cambio\\s+de\\s+tool|tool\\s+change|toolchange|line\\s*change)\\b';
    let changeOverPatternStr = process.env.CHANGE_OVER_PATTERN && String(process.env.CHANGE_OVER_PATTERN).trim()
      ? String(process.env.CHANGE_OVER_PATTERN)
      : defaultPattern;
    let changeOverRegex = null;
    try {
      // use unicode and case-insensitive flags
      changeOverRegex = new RegExp(changeOverPatternStr, 'iu');
    } catch (e) {
      console.warn('CHANGE_OVER_PATTERN is invalid, falling back to default. Pattern:', changeOverPatternStr);
      changeOverRegex = new RegExp(defaultPattern, 'iu');
    }

    // helper: split CSV line respecting quoted fields
    function splitCsvLine(line){
      const out = []; let cur = ''; let inQuotes = false;
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if (ch === '"'){
          if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
          inQuotes = !inQuotes; continue;
        }
        if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur);
      return out;
    }

    function toISOFromParts(dateStr, timeStr, isoStr){
      // Parse ISO-like string first
      try {
        if (isoStr && String(isoStr).trim() !== ''){
          // remove surrounding quotes and trailing Z if present
          const cleaned = String(isoStr).trim().replace(/^"|"$/g,'').replace(/\s+Z$/i,'').trim();
          // If it contains AM/PM, handle below; otherwise rely on Date parsing
          const ampm = /\b(AM|PM)\b/i.exec(cleaned);
          if (!ampm) {
            const parsed = new Date(cleaned);
            if (!isNaN(parsed)) return parsed;
          }
        }

        // Normalize date string: M/D/YYYY -> YYYY-MM-DD, otherwise assume it's already iso-like
        let dateISO = null;
        if (dateStr && dateStr.includes('/')) {
          const p = dateStr.split('/').map(s => s.trim());
          if (p.length === 3) dateISO = `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`;
        } else if (dateStr) {
          dateISO = dateStr.trim();
        }
        if (!dateISO) return null;

        // Normalize time: handle Spanish 'a. m.' / 'p. m.' and plain AM/PM
        let t = (timeStr || '').replace(/a\. m\.|p\. m\./gi, function(m){ return m.toUpperCase().replace(/\s/g,''); }).replace(/\s+/g,' ').trim();
        const ampm = /\b(AM|PM)\b/i.exec(t);
        // remove AM/PM for numeric parse
        let tNoAmpm = t.replace(/\s*(AM|PM)$/i,'').trim();
        // ensure seconds present
        if (tNoAmpm && tNoAmpm.split(':').length === 2) tNoAmpm = tNoAmpm + ':00';

        if (ampm) {
          const mt = tNoAmpm.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (!mt) return null;
          let hh = parseInt(mt[1],10), mm = parseInt(mt[2],10), ss = parseInt(mt[3]||'0',10);
          const ap = ampm[1].toUpperCase();
          if (ap === 'PM' && hh < 12) hh += 12;
          if (ap === 'AM' && hh === 12) hh = 0;
          const candidate = new Date(`${dateISO}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`);
          if (!isNaN(candidate)) return candidate;
          return null;
        }

        // no AM/PM, use direct parse
        const timePart = tNoAmpm || '00:00:00';
        const candidate = new Date(`${dateISO}T${timePart}`);
        if (!isNaN(candidate)) return candidate;
        return null;
      } catch (e) {
        return null;
      }
    }

    const enriched = [];
    for (const row of dataRows) {
      const parts = splitCsvLine(row);
      if (parts.length < 11) continue;
      const startFecha = parts[0];
      const startHora = parts[1];
      const startISOraw = parts[2];
      const endFecha = parts[3];
      const endHora = parts[4];
      const endISOraw = parts[5];
      const pn = parts[6] ? parts[6].replace(/^"|"$/g, '') : '';
      const piezasTotales = parseInt(parts[7]) || 0;
      const stationsJsonRaw = parts[10] || parts[parts.length-1];
      let stations = [];
      try { stations = JSON.parse(stationsJsonRaw.replace(/""/g,'"').replace(/^"|"$/g, '')); } catch (e) { stations = []; }

      const cutStart = toISOFromParts(startFecha, startHora, startISOraw);
      const cutEnd = toISOFromParts(endFecha, endHora, endISOraw);
      if (!cutStart || !cutEnd) continue;

      // compute downtime overlap in minutes
      let downtimeMinutes = 0;
      // Also detect if any overlapping stop is a Change Over (description contains 'change over' or both words)
      let changeOverDetected = false;
      const overlappingStops = [];
      for (const s of stops) {
        const overlapMs = Math.max(0, Math.min(s.end.getTime(), cutEnd.getTime()) - Math.max(s.start.getTime(), cutStart.getTime()));
        const overlapMin = Math.round(overlapMs / 60000);
        if (overlapMin > 0) {
          // capture the stop details for debugging
          const desc = String(s.descripcion || '');
          const coMatched = changeOverRegex.test(desc);
          if (coMatched) changeOverDetected = true;
          overlappingStops.push({ startISO: s.start.toISOString(), endISO: s.end.toISOString(), descripcion: desc, overlapMinutes: overlapMin, changeOverMatch: coMatched });
          if (!changeOverDetected && coMatched) changeOverDetected = true;
        }
        downtimeMinutes += overlapMin;
      }

      const durationMinutes = Math.max(1, Math.round((cutEnd.getTime() - cutStart.getTime()) / 60000));
      const availableMinutes = Math.max(0, durationMinutes - downtimeMinutes);
      const disponibilidad = durationMinutes > 0 ? (availableMinutes / durationMinutes) : 0;

      // eficiencia: piezasTotales / (ratePerHour * durationHours)
      const durationHours = Math.max(1/60, durationMinutes / 60);
      const expectedPieces = ratePerHour * durationHours;
      const eficiencia = expectedPieces > 0 ? (piezasTotales / expectedPieces) : 0;

      // calidad: find station that looks like EOL
      let eolOk = null; let eolNok = null; let calidad = null;
      for (const st of stations) {
        if (String(st.station || '').toLowerCase().includes('eol')) {
          eolOk = parseInt(st.ok) || 0;
          eolNok = parseInt(st.nok) || 0;
          const denom = eolOk + eolNok;
          calidad = denom > 0 ? (eolOk / denom) : null;
          break;
        }
      }

      // calidad percent for display (null when denom is zero)
      const calidadPercent = calidad === null ? null : (calidad * 100);

  enriched.push({ startFecha, startHora, startISO: cutStart.toISOString(), endFecha, endHora, endISO: cutEnd.toISOString(), pn, piezasTotales, durationMinutes, downtimeMinutes, disponibilidad, eficiencia, calidad, calidadPercent, eolOk, eolNok, estaciones: stations, changeOver: changeOverDetected ? 'Si' : 'No', overlappingStops });
    }

    // Apply optional from/to filtering (expect YYYY-MM-DD strings). Filter by cut start date.
    const { from: qFrom, to: qTo } = req.query;
    let finalCuts = enriched;
    if (qFrom || qTo) {
      let fromDate = qFrom ? new Date(`${qFrom}T00:00:00`) : null;
      let toDate = qTo ? new Date(`${qTo}T23:59:59`) : null;
      if (fromDate && isNaN(fromDate)) fromDate = null;
      if (toDate && isNaN(toDate)) toDate = null;
      finalCuts = enriched.filter(c => {
        const s = new Date(c.startISO);
        if (isNaN(s)) return false;
        if (fromDate && s < fromDate) return false;
        if (toDate && s > toDate) return false;
        return true;
      });
    }

    // write an enriched CSV for debugging/export
    try {
      const outPath = path.join(__dirname, '../data/EOL_Cuts_OEE.csv');
      const outHeader = 'startISO,endISO,pn,piezasTotales,durationMinutes,downtimeMinutes,disponibilidad,eficiencia,calidad,calidadPercent,eolOk,eolNok,changeOver,stations_json\n';
      let outContent = outHeader;
      for (const e of enriched) {
        const calidadCell = (e.calidad === null) ? '' : e.calidad.toFixed(4);
        const calidadPctCell = (e.calidadPercent === null) ? '' : e.calidadPercent.toFixed(2);
        const changeOverCell = (e.changeOver ? String(e.changeOver) : 'No');
        const row = `${e.startISO},${e.endISO},"${(e.pn||'').replace(/"/g,'')}",${e.piezasTotales},${e.durationMinutes},${e.downtimeMinutes},${e.disponibilidad.toFixed(4)},${e.eficiencia.toFixed(4)},${calidadCell},${calidadPctCell},${e.eolOk||0},${e.eolNok||0},${changeOverCell},"${JSON.stringify(e.estaciones).replace(/"/g,'""')}"\n`;
        outContent += row;
      }
      fs.writeFileSync(outPath, outContent, 'utf8');
    } catch (err) {
      console.error('Error escribiendo EOL_Cuts_OEE.csv:', err);
    }

    // compute period averages (only include values that are numeric)
    const numericCuts = finalCuts || [];
    let disponibilidadAvg = null, calidadAvg = null, eficienciaAvg = null;
    if (numericCuts.length > 0) {
      const dispVals = numericCuts.map(c => typeof c.disponibilidad === 'number' ? c.disponibilidad : null).filter(v => v !== null);
      const calVals = numericCuts.map(c => (typeof c.calidad === 'number') ? c.calidad : null).filter(v => v !== null);
      const efeVals = numericCuts.map(c => typeof c.eficiencia === 'number' ? c.eficiencia : null).filter(v => v !== null);
      if (dispVals.length > 0) disponibilidadAvg = dispVals.reduce((a,b)=>a+b,0)/dispVals.length;
      if (calVals.length > 0) calidadAvg = calVals.reduce((a,b)=>a+b,0)/calVals.length;
      if (efeVals.length > 0) eficienciaAvg = efeVals.reduce((a,b)=>a+b,0)/efeVals.length;
    }

  res.json({ cuts: finalCuts, summary: {
    disponibilidadAvg: (disponibilidadAvg===null? null : Number(disponibilidadAvg)),
    calidadAvg: (calidadAvg===null? null : Number(calidadAvg)),
    eficienciaAvg: (eficienciaAvg===null? null : Number(eficienciaAvg))
  } });
  } catch (err) {
    console.error('Error en /rea-production-eolo-cuts-oee:', err);
    res.status(500).send('Error procesando cortes OEE');
  }
});
  
  

module.exports = router;

