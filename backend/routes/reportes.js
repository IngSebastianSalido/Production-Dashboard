const express = require('express');
const fs = require('fs');

module.exports = (productionFilePath) => {
  const router = express.Router();

  // Endpoint para guardar o actualizar un reporte de producción
  router.post('/reportes', (req, res) => {
    const { fecha, area, linea, pn, hora, piezas_ok, piezas_nok } = req.body;

    if (!fecha || !area || !linea || !pn || !hora || piezas_ok === undefined || piezas_nok === undefined) {
        return res.status(400).send('Todos los campos son obligatorios');
    }

    // Leer el archivo CSV
    fs.readFile(productionFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de producción:', err);
            return res.status(500).send('No se pudo leer el archivo de producción. Verifique permisos.');
        }

        const rows = data.split('\n');
        const headers = rows[0]; // Encabezados
        let registros = rows.slice(1).filter(row => row.trim() !== '');

        // Buscar si ya existe un registro con la misma fecha, área, línea, PN y hora
        const index = registros.findIndex(row => {
            const cols = row.split(';');
            return cols.length === 7 && cols[0] === fecha && cols[1] === area && cols[2] === linea && cols[3] === pn && cols[4] === hora;
        });

        const nuevoRegistro = `${fecha};${area};${linea};${pn};${hora};${piezas_ok};${piezas_nok}`;

        if (index !== -1) {
            // Actualizar registro existente
            registros[index] = nuevoRegistro;
        } else {
            // Agregar nuevo registro
            registros.push(nuevoRegistro);
        }

        // Guardar los datos actualizados en el archivo CSV
        const nuevoContenido = [headers, ...registros].join('\n');
        fs.writeFile(productionFilePath, nuevoContenido, (err) => {
            if (err) {
                console.error('Error al guardar el reporte:', err);
                return res.status(500).send('Error al guardar el reporte');
            }
            res.send('Reporte guardado correctamente');
        });
    });
  });

  // Endpoint para obtener reportes por fecha, área, línea y PN
  router.get('/reportes/:fecha/:area/:linea/:pn', (req, res) => {
    const { fecha, area, linea, pn } = req.params;

    fs.readFile(productionFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de producción:', err);
            return res.status(500).send('No se pudo leer el archivo de producción.');
        }

        const reportes = data
            .split('\n')
            .slice(1)
            .filter(line => {
                const cols = line.split(';');
                return cols.length === 7 && cols[0] === fecha && cols[1].toLowerCase() === area.toLowerCase() && cols[2].toLowerCase() === linea.toLowerCase() && cols[3].toLowerCase() === pn.toLowerCase();
            })
            .map(line => line.split(';')) // Convertir cada línea en un array
            .sort((a, b) => a[4].localeCompare(b[4])); // Ordenar por hora

        res.json(reportes);
    });
  });

  // Endpoint para obtener reportes por fecha (todas las áreas y líneas)
  router.get('/reportes/:fecha', (req, res) => {
    const { fecha } = req.params;

    fs.readFile(productionFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de producción:', err);
            return res.status(500).send('No se pudo leer el archivo de producción.');
        }

        const reportes = data
            .split('\n')
            .slice(1)
            .filter(line => {
                const cols = line.split(';');
                return cols.length === 7 && cols[0] === fecha;
            })
            .map(line => line.split(';')) // Convertir cada línea en un array
            .sort((a, b) => a[4].localeCompare(b[4])); // Ordenar por hora

        res.json(reportes);
    });
  });

  return router;
};
