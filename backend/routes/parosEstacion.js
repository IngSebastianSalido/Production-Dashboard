const express = require('express');
const fs = require('fs');
const path = require('path');

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
        const rows = data.split('\n').slice(1).filter(line => line.trim() !== '');
        
        // Parsear las fechas de filtro
        const fechaInicioDate = new Date(fechaInicio);
        const fechaFinDate = new Date(fechaFin);

        // Objeto para acumular tiempos por estación
        const estacionesMap = {};

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

          // Acumular tiempo por estación
          const minutos = parseInt(diferencia_minutos) || 0;
          
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

  return router;
};
