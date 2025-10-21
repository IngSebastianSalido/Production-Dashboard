const express = require('express');
const fs = require('fs');

module.exports = (productionTimestampsPath) => {
  const router = express.Router();

  // Utilidad: parsear fecha y hora (formato M/D/YYYY y hh:mm:ss AM/PM)
  function parseUSDateTime(dateStr, timeStr) {
    // Normalizar separadores
    const [month, day, year] = dateStr.split(/[\/]/).map(Number);
    // Extraer hora en 12h con AM/PM
    const match = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let [_, hh, mm, ss, ap] = match;
    let hour = parseInt(hh, 10);
    const min = parseInt(mm, 10);
    const sec = parseInt(ss, 10);
    const isPM = ap.toUpperCase() === 'PM';
    if (hour === 12) hour = isPM ? 12 : 0; else hour = isPM ? hour + 12 : hour;
    return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
  }

  // Leer y parsear ProductionReport.csv devolviendo { headers, rows }
  function readProductionTimestamps() {
    if (!fs.existsSync(productionTimestampsPath)) {
      throw new Error(`Archivo no encontrado: ${productionTimestampsPath}`);
    }
    const raw = fs.readFileSync(productionTimestampsPath, 'utf8').trim();
    const lines = raw.split(/\r?\n/);
    const headers = lines[0].split(';'); // ProductionReport usa ';'
    const rows = lines.slice(1).map(l => l.split(';'));
    return { headers, rows };
  }

  // Detectar máquinas desde encabezados: pares Ok/Nok a partir del índice 3
  function getMachinesFromHeaders(headers) {
    const machines = [];
    for (let i = 3; i < headers.length; i += 2) {
      const okHeader = headers[i];
      const nokHeader = headers[i + 1];
      // Derivar nombre de máquina del header terminando en Ok/Nok
      const name = okHeader.replace(/Ok$/i, '').replace(/OK$/i, '');
      machines.push({ name, okIndex: i, nokIndex: i + 1 });
    }
    return machines;
  }

  // Endpoint: resumen por máquina (sumando diferencias entre timestamps)
  // GET /api/reports/production-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&recipe=RECIPE
  router.get('/reports/production-summary', (req, res) => {
    try {
      const { from, to, recipe } = req.query;
      if (!from || !to) {
        return res.status(400).json({ error: 'Parámetros from y to son requeridos (YYYY-MM-DD)' });
      }
      const fromDate = new Date(`${from}T00:00:00Z`);
      const toDate = new Date(`${to}T23:59:59Z`);

      const { headers, rows } = readProductionTimestamps();
      const machines = getMachinesFromHeaders(headers);
      const recipeIdx = headers.indexOf('RECIPE');
      const dateIdx = headers.indexOf('DateAcquisition');
      const timeIdx = headers.indexOf('TimeAcquisition');
      if (recipeIdx === -1 || dateIdx === -1 || timeIdx === -1) {
        return res.status(500).json({ error: 'Encabezados inválidos en ProductionReport.csv' });
      }

      // Preparar acumuladores y previos
      const totals = {};
      const prev = {};
      machines.forEach(m => { totals[m.name] = { ok: 0, nok: 0, total: 0 }; prev[m.name] = null; });

      // Filtrar filas en rango y por receta (si aplica) y ordenarlas por tiempo
      const filtered = rows
        .map(cols => ({ cols, ts: parseUSDateTime(cols[dateIdx], cols[timeIdx]) }))
        .filter(r => r.ts && r.ts >= fromDate && r.ts <= toDate && (!recipe || (r.cols[recipeIdx] || '').toString() === recipe))
        .sort((a, b) => a.ts - b.ts)
        .map(r => r.cols);

      // Recorrer filas y acumular deltas por máquina
      for (const cols of filtered) {
        machines.forEach(m => {
          const okVal = parseInt(cols[m.okIndex], 10) || 0;
          const nokVal = parseInt(cols[m.nokIndex], 10) || 0;
          const p = prev[m.name];
          if (p) {
            const dOk = okVal - p.ok;
            const dNok = nokVal - p.nok;
            const incOk = dOk > 0 ? dOk : 0; // manejar resets
            const incNok = dNok > 0 ? dNok : 0;
            totals[m.name].ok += incOk;
            totals[m.name].nok += incNok;
            totals[m.name].total += incOk + incNok;
          }
          prev[m.name] = { ok: okVal, nok: nokVal };
        });
      }

      // Formato de respuesta
      const result = machines.map(m => ({ machine: m.name, ...totals[m.name] }));
      res.json({ from, to, recipe: recipe || null, machines: result });
    } catch (e) {
      console.error('Error en /api/reports/production-summary:', e);
      res.status(500).json({ error: e.message || 'Error procesando resumen' });
    }
  });

  // Endpoint: obtener lista de recetas disponibles (opcionalmente en rango)
  // GET /api/reports/recipes?from=YYYY-MM-DD&to=YYYY-MM-DD
  router.get('/reports/recipes', (req, res) => {
    try {
      const { from, to } = req.query;
      const { headers, rows } = readProductionTimestamps();
      const recipeIdx = headers.indexOf('RECIPE');
      const dateIdx = headers.indexOf('DateAcquisition');
      const timeIdx = headers.indexOf('TimeAcquisition');

      let set = new Set();
      if (from && to) {
        const fromDate = new Date(`${from}T00:00:00Z`);
        const toDate = new Date(`${to}T23:59:59Z`);
        rows.forEach(cols => {
          const ts = parseUSDateTime(cols[dateIdx], cols[timeIdx]);
          if (ts && ts >= fromDate && ts <= toDate) set.add(cols[recipeIdx] || '');
        });
      } else {
        rows.forEach(cols => set.add(cols[recipeIdx] || ''));
      }

      // Antes: filtraba 'UNKNOWN'. Ahora se incluye, solo se filtran valores vacíos
      const recipes = Array.from(set).filter(r => r !== undefined && r !== null && String(r).trim() !== '');
      res.json({ recipes });
    } catch (e) {
      console.error('Error en /api/reports/recipes:', e);
      res.status(500).json({ error: e.message || 'Error obteniendo recetas' });
    }
  });

  // Endpoint: totales por día por máquina (devuelve lista de máquinas y por cada día un array de totales por máquina)
  // GET /api/reports/production-by-day?from=YYYY-MM-DD&to=YYYY-MM-DD[&recipe=RECIPE]
  router.get('/reports/production-by-day', (req, res) => {
    try {
      const { from, to, recipe } = req.query;
      if (!from || !to) {
        return res.status(400).json({ error: 'Parámetros from y to son requeridos (YYYY-MM-DD)' });
      }
      const fromDate = new Date(`${from}T00:00:00Z`);
      const toDate = new Date(`${to}T23:59:59Z`);

      const { headers, rows } = readProductionTimestamps();
      const machinesInfo = getMachinesFromHeaders(headers);
      const machineNames = machinesInfo.map(m => m.name);
      const recipeIdx = headers.indexOf('RECIPE');
      const dateIdx = headers.indexOf('DateAcquisition');
      const timeIdx = headers.indexOf('TimeAcquisition');
      if (recipeIdx === -1 || dateIdx === -1 || timeIdx === -1) {
        return res.status(500).json({ error: 'Encabezados inválidos en ProductionReport.csv' });
      }

      // Filtrar filas en rango y por receta (si aplica) y ordenarlas por tiempo, manteniendo ts
      const filtered = rows
        .map(cols => ({ cols, ts: parseUSDateTime(cols[dateIdx], cols[timeIdx]) }))
        .filter(r => r.ts && r.ts >= fromDate && r.ts <= toDate && (!recipe || (r.cols[recipeIdx] || '').toString() === recipe))
        .sort((a, b) => a.ts - b.ts);

      // Prev por máquina para calcular deltas
      const prev = {};
      machinesInfo.forEach(m => { prev[m.name] = null; });

      // Acumulador por día -> dateStr -> { oks: [], noks: [] } alineado con machineNames
      const days = new Map();

      for (const row of filtered) {
        const cols = row.cols;
        const ts = row.ts;
        const dateStr = ts.toISOString().slice(0, 10); // YYYY-MM-DD UTC
        if (!days.has(dateStr)) days.set(dateStr, { oks: new Array(machineNames.length).fill(0), noks: new Array(machineNames.length).fill(0) });
        const bucket = days.get(dateStr);

        machinesInfo.forEach((m, idx) => {
          const okVal = parseInt(cols[m.okIndex], 10) || 0;
          const nokVal = parseInt(cols[m.nokIndex], 10) || 0;
          const p = prev[m.name];
          if (p) {
            const dOk = okVal - p.ok;
            const dNok = nokVal - p.nok;
            const incOk = dOk > 0 ? dOk : 0;
            const incNok = dNok > 0 ? dNok : 0;
            bucket.oks[idx] += incOk;
            bucket.noks[idx] += incNok;
          }
          prev[m.name] = { ok: okVal, nok: nokVal };
        });
      }

      // Transformar a array ordenado
      const resultDays = Array.from(days.entries())
        .map(([date, vals]) => ({ date, oks: vals.oks, noks: vals.noks }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json({ from, to, recipe: recipe || null, machines: machineNames, days: resultDays });
    } catch (e) {
      console.error('Error en /api/reports/production-by-day:', e);
      res.status(500).json({ error: e.message || 'Error procesando totales por día' });
    }
  });

  // Endpoint: descargar copia del ProductionReport.csv actual
  // GET /api/reports/download-production-csv
  router.get('/reports/download-production-csv', (req, res) => {
    try {
      if (!fs.existsSync(productionTimestampsPath)) {
        return res.status(404).json({ error: 'Archivo de ProductionReport no encontrado' });
      }
      const filename = `ProductionReport_Copy_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.csv`;
      res.download(productionTimestampsPath, filename, (err) => {
        if (err) console.error('Error enviando ProductionReport CSV:', err);
      });
    } catch (e) {
      console.error('Error en /api/reports/download-production-csv:', e);
      res.status(500).json({ error: e.message || 'Error descargando archivo' });
    }
  });

  return router;
};
