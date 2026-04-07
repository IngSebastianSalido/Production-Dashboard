const express = require('express');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { resolveParoProgramado } = require('../lib/paroProgramado');

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateDDMMYYYY(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

function normalizeParoProgramado(categoriaData, descripcionModoFalla, paroProgramadoData) {
  let paroProgramadoFinal = paroProgramadoData;
  if (!paroProgramadoFinal || paroProgramadoFinal.trim() === '') {
    paroProgramadoFinal = resolveParoProgramado(categoriaData, descripcionModoFalla);
  }
  return paroProgramadoFinal;
}

function getFilteredStopRows(rawData, filters) {
  const {
    fechaInicio,
    fechaFin,
    area,
    linea,
    pn,
    categoria,
    paroProgramado
  } = filters;

  const fechaInicioDate = parseDateOnly(fechaInicio);
  const fechaFinDate = parseDateOnly(fechaFin);

  if (!fechaInicioDate || !fechaFinDate) {
    return [];
  }

  const rows = rawData.split('\n').slice(1).filter(line => line.trim() !== '');
  const filtered = [];

  rows.forEach((row) => {
    const cols = row.split(';');

    const [
      fecha,
      areaData,
      lineaData,
      pnData,
      hora_paro,
      hora_arranque,
      diferencia_minutos,
      categoriaData,
      estacion,
      modo_falla,
      descripcion_modo_falla,
      descripcion,
      paroProgramadoData
    ] = cols;

    if (!fecha || !estacion || diferencia_minutos === undefined || diferencia_minutos === null || diferencia_minutos === '') return;

    const fechaRegistro = parseDateOnly(fecha);
    if (!fechaRegistro) return;

    const paroProgramadoFinal = normalizeParoProgramado(categoriaData, descripcion_modo_falla, paroProgramadoData);

    if (fechaRegistro < fechaInicioDate || fechaRegistro > fechaFinDate) return;
    if (area && areaData !== area) return;
    if (linea && lineaData !== linea) return;
    if (pn && pnData !== pn) return;
    if (categoria && categoriaData !== categoria) return;
    if (paroProgramado && paroProgramadoFinal !== paroProgramado) return;

    filtered.push({
      fecha,
      area: areaData,
      linea: lineaData,
      pn: pnData,
      hora_paro,
      hora_arranque,
      diferencia_minutos,
      categoria: categoriaData,
      estacion,
      modo_falla,
      descripcion_modo_falla,
      descripcion,
      paro_programado: paroProgramadoFinal
    });
  });

  return filtered;
}

function buildDateRange(fechaInicio, fechaFin) {
  const start = parseDateOnly(fechaInicio);
  const end = parseDateOnly(fechaFin);
  if (!start || !end || start > end) return [];

  const range = [];
  const current = new Date(start);

  while (current <= end) {
    range.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return range;
}

function getPreferredStationOrder() {
  try {
    const optionsPath = path.join(__dirname, '..', 'options.json');
    if (!fs.existsSync(optionsPath)) return [];

    const rawOptions = fs.readFileSync(optionsPath, 'utf8');
    const parsedOptions = JSON.parse(rawOptions);
    if (!Array.isArray(parsedOptions.estaciones)) return [];

    return parsedOptions.estaciones
      .map((item) => (item && (item.name || item)) || null)
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

module.exports = (stopsFilePath) => {
  const router = express.Router();

  // Endpoint para obtener los paros agrupados por estación
  router.get('/paros-por-estacion', (req, res) => {
    const { fechaInicio, fechaFin, area, linea, pn, categoria, paroProgramado } = req.query;

    console.log('Filtros recibidos:', { fechaInicio, fechaFin, area, linea, pn, categoria, paroProgramado });

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Se requiere rango de fechas (fechaInicio y fechaFin)' });
    }

    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error al leer el archivo de paros:', err);
        return res.status(500).json({ error: 'No se pudo leer el archivo de paros' });
      }

      try {
        const filteredRows = getFilteredStopRows(data, {
          fechaInicio,
          fechaFin,
          area,
          linea,
          pn,
          categoria,
          paroProgramado
        });

        // Objeto para acumular tiempos por estación
        const estacionesMap = {};

<<<<<<< HEAD
        rows.forEach(row => {
          const cols = row.split(';');
          
          // Estructura del CSV: fecha;area;linea;pn;hora_paro;hora_arranque;diferencia_minutos;categoria;estacion;modo_falla;descripcion_modo_falla;descripcion;paro_programado
          const [
            fecha,
            areaData,
            lineaData,
            pnData,
            hora_paro,
            hora_arranque,
            diferencia_minutos,
            categoriaData,
            estacion,
            modo_falla,
            descripcion_modo_falla,
            descripcion,
            paroProgramadoData
          ] = cols;

          if (!fecha || !estacion || !diferencia_minutos) return;

          // Convertir fecha del registro
          const fechaRegistro = new Date(fecha);

          // Calcular paro_programado si no existe en el registro
          let paroProgramadoFinal = paroProgramadoData;
          if (!paroProgramadoFinal || paroProgramadoFinal.trim() === '') {
            const esCategoriaFallo = categoriaData.toLowerCase().trim() === 'equipment fault' || categoriaData.toLowerCase().trim() === 'fallo';
            paroProgramadoFinal = esCategoriaFallo ? 'No' : 'Si';
          }

          // Aplicar filtros
          if (fechaRegistro < fechaInicioDate || fechaRegistro > fechaFinDate) return;
          if (area && areaData !== area) return;
          if (linea && lineaData !== linea) return;
          if (pn && pnData !== pn) return;
          if (categoria && categoriaData !== categoria) return;
          if (paroProgramado && paroProgramadoFinal !== paroProgramado) return;

=======
        filteredRows.forEach((stopRow) => {
>>>>>>> c2798f29e577cdb7b6530ca9c5ad3fb4c1680dfc
          // Acumular tiempo por estación
          const minutos = parseInt(stopRow.diferencia_minutos, 10) || 0;
          const estacion = stopRow.estacion;
          
          if (!estacionesMap[estacion]) {
            estacionesMap[estacion] = {
              estacion: estacion,
              tiempoTotal: 0,
              cantidadParos: 0
            };
          }

          estacionesMap[estacion].tiempoTotal += minutos;
          estacionesMap[estacion].cantidadParos += 1;
        });

        // Convertir el map a array y ordenar por tiempo total descendente
        const resultado = Object.values(estacionesMap).sort((a, b) => b.tiempoTotal - a.tiempoTotal);

        res.json(resultado);
      } catch (error) {
        console.error('Error al procesar los paros:', error);
        res.status(500).json({ error: 'Error al procesar los datos de paros' });
      }
    });
  });

  // Endpoint para exportar matriz diaria de paros por estación en Excel
  router.get('/paros-por-estacion/export-excel-diario', async (req, res) => {
    const { fechaInicio, fechaFin, area, linea, pn, categoria, paroProgramado } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Se requiere rango de fechas (fechaInicio y fechaFin)' });
    }

    fs.readFile(stopsFilePath, 'utf8', async (err, data) => {
      if (err) {
        console.error('Error al leer el archivo de paros:', err);
        return res.status(500).json({ error: 'No se pudo leer el archivo de paros' });
      }

      try {
        const filteredRows = getFilteredStopRows(data, {
          fechaInicio,
          fechaFin,
          area,
          linea,
          pn,
          categoria,
          paroProgramado
        });

        const estacionesSet = new Set(filteredRows.map((row) => row.estacion).filter(Boolean));
        const preferredOrder = getPreferredStationOrder();
        const estacionesEnOrdenPreferido = preferredOrder.filter((estacion) => estacionesSet.has(estacion));
        const estacionesRestantes = [...estacionesSet]
          .filter((estacion) => !preferredOrder.includes(estacion))
          .sort((a, b) => a.localeCompare(b, 'es'));
        const estaciones = [...estacionesEnOrdenPreferido, ...estacionesRestantes];
        const dateRange = buildDateRange(fechaInicio, fechaFin);

        if (dateRange.length === 0) {
          return res.status(400).json({ error: 'Rango de fechas inválido' });
        }

        const minutosPorDiaYEstacion = {};

        filteredRows.forEach((row) => {
          const fechaKey = row.fecha;
          const estacion = row.estacion;
          const minutos = parseFloat(row.diferencia_minutos) || 0;

          if (!minutosPorDiaYEstacion[fechaKey]) {
            minutosPorDiaYEstacion[fechaKey] = {};
          }

          if (!minutosPorDiaYEstacion[fechaKey][estacion]) {
            minutosPorDiaYEstacion[fechaKey][estacion] = 0;
          }

          minutosPorDiaYEstacion[fechaKey][estacion] += minutos;
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Paros por Estación');

        const headers = ['Fecha', ...estaciones];
        worksheet.addRow(headers);

        dateRange.forEach((dateObj) => {
          const yyyy = dateObj.getFullYear();
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          const fechaKey = `${yyyy}-${mm}-${dd}`;

          const rowData = [formatDateDDMMYYYY(dateObj)];

          estaciones.forEach((estacion) => {
            const minutos = (minutosPorDiaYEstacion[fechaKey] && minutosPorDiaYEstacion[fechaKey][estacion]) || 0;
            const horasDecimales = Number((minutos / 60).toFixed(2));
            rowData.push(horasDecimales);
          });

          worksheet.addRow(rowData);
        });

        worksheet.columns.forEach((column, idx) => {
          if (idx === 0) {
            column.width = 14;
          } else {
            column.width = 12;
            column.numFmt = '0.00';
          }
        });

        const fileDate = new Date().toISOString().slice(0, 10);
        const fileName = `Paros_Estacion_Diario_${fileDate}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();
      } catch (error) {
        console.error('Error al exportar Excel diario de paros por estación:', error);
        res.status(500).json({ error: 'Error al generar el archivo Excel' });
      }
    });
  });

  return router;
};
