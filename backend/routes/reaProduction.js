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

        const estaciones = [];

        for (let i = 2; i < columns.length; i += 2) {
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

        resultados.push({ fecha, hora, estaciones });
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
      const dataRows = rows.slice(-40000);

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

// 🔥🚀🚀🚀 NUEVO ENDPOINT QUE FALTABA: /rea-production-eolo-graph
// 🚀 Leer HrperHrReport para gráficas (siempre actualizar)
router.get('/rea-production-eolo-graph', async (req, res) => {
    const { fecha } = req.query;
  
    if (!fecha) {
      return res.status(400).send('Se requiere el parámetro fecha en formato YYYY-MM-DD.');
    }
  
    try {
      // 🔥 Siempre regenerar HrperHrReport.csv, no importa si existe
      await new Promise((resolve, reject) => {
        fs.readFile(reaSourceFilePath, 'utf8', (err, data) => {
          if (err) return reject('Error leyendo ProductionReport original.');
  
          const rows = data.split('\n').filter(row => row.trim() !== '');
          const header = rows[0].split(';');
          const dataRows = rows.slice(-40000);
  
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
  
      // 🔥 Ahora leer HrperHrReport.csv actualizado
      const data = fs.readFileSync(outputCsvPath, 'utf8');
      const rows = data.split('\n').filter(row => row.trim() !== '');
      const header = rows[0].split(',');
      const dataRows = rows.slice(1);
  
      const registros = [];
  
      for (const row of dataRows) {
        const columns = row.split(',');
        const fechaRow = columns[0];
        const horaCompleta = columns[1];
        const piezasProducidas = parseInt(columns[2]) || 0;
  
        if (fechaRow === fecha) {
          const horaSolo = horaCompleta.split(':')[0] + ":00";
          registros.push({ hora: horaSolo, piezasProducidas });
        }
      }
  
      const datosPorHora = {};
      for (const registro of registros) {
        if (!datosPorHora[registro.hora]) datosPorHora[registro.hora] = 0;
        datosPorHora[registro.hora] += registro.piezasProducidas;
      }
  
      const datosOrdenados = Object.keys(datosPorHora)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(hora => ({ hora, piezasProducidas: datosPorHora[hora] }));
  
      res.json(datosOrdenados);
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Error procesando la gráfica.');
    }
  });
  
  

module.exports = router;
