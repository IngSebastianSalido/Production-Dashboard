const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = (stopsFilePath) => {
  const router = express.Router();

  // Función auxiliar para parsear una fecha en múltiples formatos
  const parseFecha = (fechaStr) => {
    if (!fechaStr) return null;
    
    // Intentar formato YYYY-MM-DD (formato ISO)
    if (fechaStr.includes('-')) {
      const date = new Date(fechaStr + 'T00:00:00');
      if (!isNaN(date.getTime())) return date;
    }
    
    // Intentar formato M/D/YYYY
    const parts = String(fechaStr).split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
    
    return new Date(fechaStr);
  };

  const parseHora = (horaStr) => {
    if (!horaStr) return null;

    const match = String(horaStr).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3] || '0', 10);
    const meridiem = match[4] ? match[4].toUpperCase() : null;

    if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    } else if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    }

    if (hours > 23 || minutes > 59 || seconds > 59) return null;

    return { hours, minutes, seconds };
  };

  const parseFechaHora = (fechaStr, horaStr) => {
    const fecha = parseFecha(fechaStr);
    const hora = parseHora(horaStr);

    if (!fecha || isNaN(fecha.getTime()) || !hora) return null;

    fecha.setHours(hora.hours, hora.minutes, hora.seconds, 0);
    return fecha;
  };

  const inferBatchArea = (batchPn) => {
    const normalizedPn = String(batchPn || '').toUpperCase();

    if (normalizedPn.includes('REA')) return 'REA';
    if (normalizedPn.includes('COVER')) return 'COVER LINE';

    return null;
  };

  // Función auxiliar para parsear una hora en formato HH:MM a Date completa
  // Considerando el contexto del batch para horas ambiguas
  const parseDateTime = (fechaStr, horaStr, batchStart) => {
    if (!fechaStr || !horaStr) return null;
    const fecha = parseFechaHora(fechaStr, horaStr);
    if (!fecha) return null;

    // Si el batch cruza medianoche y esta fecha es después de la fecha de inicio del batch,
    // y la hora es pequeña, probablemente es AM del siguiente día
    if (batchStart && fecha.toDateString() !== new Date(batchStart).toDateString()) {
      // Fechas diferentes: la del paro es probablemente al siguiente día
      // No modificar la hora, mantenerla como está (ya en AM)
    }

    return fecha;
  };

  // Función para determinar si un paro pertenece a un batch basado en el rango de tiempo
  const paroEnBatch = (paro, batchStart, batchEnd) => {
    const pararoDateTime = parseDateTime(paro.fecha, paro.hora_paro, batchStart);
    const arranqueDateTime = parseDateTime(paro.fecha, paro.hora_arranque, batchStart);
    
    if (!pararoDateTime) return false;
    
    // El paro está en el batch si inicia dentro del rango del batch (excluyendo exactamente el fin)
    if (pararoDateTime >= batchStart && pararoDateTime < batchEnd) {
      return true;
    }
    
    // O si el arranque está dentro del rango
    if (arranqueDateTime && arranqueDateTime >= batchStart && arranqueDateTime < batchEnd) {
      return true;
    }
    
    // O si el paro abarca todo el batch (inicia antes y termina después)
    if (arranqueDateTime && pararoDateTime < batchStart && arranqueDateTime > batchEnd) {
      return true;
    }
    
    return false;
  };

  // Endpoint: Obtener batches con sus paros asociados
  router.get('/paros-por-batch', async (req, res) => {
    try {
      const { from, to } = req.query;
      
      if (!from || !to) {
        return res.status(400).json({ error: 'Se requieren los parámetros from y to' });
      }

      console.log('📊 Obteniendo paros por batch ID...');
      console.log('Fecha desde:', from);
      console.log('Fecha hasta:', to);

      // 1. Leer archivo de paros
      const parosPath = stopsFilePath || path.join(__dirname, '../data/paros.csv');
      if (!fs.existsSync(parosPath)) {
        return res.status(404).json({ error: 'Archivo de paros no encontrado' });
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

      // 2. Leer archivo EOL_Cuts.csv para obtener los batch IDs con sus rangos
      const eolCutsPath = path.join(__dirname, '../data/EOL_Cuts.csv');
      if (!fs.existsSync(eolCutsPath)) {
        return res.status(404).json({ 
          error: 'Archivo EOL_Cuts.csv no encontrado. Ejecuta primero /api/rea-production-eolo-cuts-oee' 
        });
      }

      const eolCutsRaw = fs.readFileSync(eolCutsPath, 'utf8');
      const eolCutsRows = eolCutsRaw.split('\n').filter(r => r.trim() !== '');
      
      const batches = [];
      
      // Parsear CSV con comillas
      for (let i = 1; i < eolCutsRows.length; i++) {
        const line = eolCutsRows[i];
        const cols = [];
        let currentCol = '';
        let insideQuotes = false;
        
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            cols.push(currentCol.trim());
            currentCol = '';
          } else {
            currentCol += char;
          }
        }
        cols.push(currentCol.trim());

        if (cols.length >= 9) {
          const batchId = cols[0].replace(/"/g, '');
          const startISO = cols[3].replace(/"/g, ''); // startFechaHoraISO está en columna 3
          const endISO = cols[6].replace(/"/g, ''); // endFechaHoraISO está en columna 6
          const startFecha = cols[1] ? cols[1].replace(/"/g, '') : '';
          const startHora = cols[2] ? cols[2].replace(/"/g, '') : '';
          const endFecha = cols[4] ? cols[4].replace(/"/g, '') : '';
          const endHora = cols[5] ? cols[5].replace(/"/g, '') : '';
          const pn = cols[7] ? cols[7].replace(/"/g, '') : ''; // pn está en columna 7
          const piezasTotales = cols[8] ? parseInt(cols[8]) : 0; // piezasTotales en columna 8
          const durationMinutes = 0; // Calcular después
          
          const batchStart = parseFechaHora(startFecha, startHora) || new Date(startISO);
          const batchEnd = parseFechaHora(endFecha, endHora) || new Date(endISO);

          if (isNaN(batchStart.getTime()) || isNaN(batchEnd.getTime())) {
            continue;
          }
          
          // Calcular duración en minutos
          const calculatedDuration = Math.round((batchEnd - batchStart) / (1000 * 60));
          
          // Filtrar por rango de fechas
          if (batchStart >= new Date(from) && batchStart <= new Date(to + 'T23:59:59')) {
            batches.push({
              batchId,
              startISO,
              endISO,
              pn,
              piezasTotales,
              durationMinutes: calculatedDuration,
              batchStart,
              batchEnd
            });
          }
        }
      }

      console.log(`✅ Batches cargados: ${batches.length} registros`);
      
      // Debug: Mostrar primer batch y primer paro
      if (batches.length > 0) {
        console.log('📌 Ejemplo de batch:', {
          batchId: batches[0].batchId,
          start: batches[0].batchStart.toISOString(),
          end: batches[0].batchEnd.toISOString()
        });
      }
      if (paros.length > 0) {
        console.log('📌 Ejemplo de paro:', {
          fecha: paros[0].fecha,
          hora_paro: paros[0].hora_paro,
          parsed: parseDateTime(paros[0].fecha, paros[0].hora_paro)?.toISOString()
        });
      }

      // 3. Asociar paros a cada batch
      const batchesConParos = batches.map(batch => {
        const batchArea = inferBatchArea(batch.pn);
        const parosAsociados = paros.filter(paro => 
          paroEnBatch(paro, batch.batchStart, batch.batchEnd) &&
          (!batchArea || String(paro.area || '').toUpperCase() === batchArea)
        );

        // Calcular totales de paros
        const totalParosMinutos = parosAsociados.reduce((sum, p) => sum + p.diferencia_minutos, 0);
        const parosProgramados = parosAsociados.filter(p => p.paro_programado && p.paro_programado.toLowerCase() === 'si');
        const parosNoProgramados = parosAsociados.filter(p => !p.paro_programado || p.paro_programado.toLowerCase() !== 'si');
        const totalParosProgramadosMinutos = parosProgramados.reduce((sum, p) => sum + p.diferencia_minutos, 0);
        const totalParosNoProgramadosMinutos = parosNoProgramados.reduce((sum, p) => sum + p.diferencia_minutos, 0);

        return {
          batchId: batch.batchId,
          startISO: batch.batchStart.toISOString(),
          endISO: batch.batchEnd.toISOString(),
          pn: batch.pn,
          piezasTotales: batch.piezasTotales,
          durationMinutes: batch.durationMinutes,
          totalParos: parosAsociados.length,
          totalParosMinutos,
          totalParosProgramados: parosProgramados.length,
          totalParosProgramadosMinutos,
          totalParosNoProgramados: parosNoProgramados.length,
          totalParosNoProgramadosMinutos,
          paros: parosAsociados
        };
      });

      // 4. Calcular promedios y totales generales
      const summary = {
        totalBatches: batchesConParos.length,
        totalParos: batchesConParos.reduce((sum, b) => sum + b.totalParos, 0),
        totalParosMinutos: batchesConParos.reduce((sum, b) => sum + b.totalParosMinutos, 0),
        totalParosProgramados: batchesConParos.reduce((sum, b) => sum + b.totalParosProgramados, 0),
        totalParosProgramadosMinutos: batchesConParos.reduce((sum, b) => sum + b.totalParosProgramadosMinutos, 0),
        totalParosNoProgramados: batchesConParos.reduce((sum, b) => sum + b.totalParosNoProgramados, 0),
        totalParosNoProgramadosMinutos: batchesConParos.reduce((sum, b) => sum + b.totalParosNoProgramadosMinutos, 0),
        promedioParosPorBatch: batchesConParos.length > 0 
          ? (batchesConParos.reduce((sum, b) => sum + b.totalParos, 0) / batchesConParos.length).toFixed(2)
          : 0,
        promedioMinutosPorBatch: batchesConParos.length > 0
          ? (batchesConParos.reduce((sum, b) => sum + b.totalParosMinutos, 0) / batchesConParos.length).toFixed(2)
          : 0
      };

      console.log('✅ Procesamiento completado');
      res.json({
        batches: batchesConParos,
        summary
      });

    } catch (err) {
      console.error('❌ Error en /paros-por-batch:', err);
      res.status(500).json({ error: 'Error al procesar los paros por batch', details: err.message });
    }
  });

  return router;
};
