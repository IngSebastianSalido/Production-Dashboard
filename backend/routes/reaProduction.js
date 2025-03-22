const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

// Ruta absoluta del archivo especial para REA Ford
const reaFilePath = path.resolve(__dirname, '../data/ProductionReport.csv'); // Destino en la carpeta data
const sourceFilePath = process.env.REA_SOURCE_FILE_PATH; // Origen del archivo especificado en el .env

router.get('/rea-production', (req, res) => {
    // Verificar si la ruta de origen está configurada
    if (!sourceFilePath) {
        console.error('La ruta de origen del archivo no está configurada en las variables de entorno.');
        return res.status(500).send('La ruta de origen del archivo no está configurada.');
    }

    // Copiar el archivo desde la ubicación de origen a la carpeta data
    fs.copyFile(sourceFilePath, reaFilePath, (err) => {
        if (err) {
            console.error('Error al copiar el archivo desde la ubicación de origen:', err);
            return res.status(500).send('Error al copiar el archivo desde la ubicación de origen.');
        }

        console.log('Archivo copiado exitosamente desde la ubicación de origen.');

        // Leer el archivo copiado
        fs.readFile(reaFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error leyendo archivo de producción REA:', err);
                return res.status(500).send('Error leyendo archivo REA');
            }

            console.log('Contenido del archivo REA cargado.');

            const rows = data.split('\n').filter(row => row.trim() !== '');
            const header = rows[0].split(';'); // Leer la cabecera
            const totalRows = rows.length;

            // Procesar solo las últimas 10,000 filas (o menos si hay menos filas)
            const dataRows = rows.slice(Math.max(totalRows - 1, 1)); // Ignorar la cabecera

            const resultados = [];

            // Procesar las filas de datos
            for (const row of dataRows) {
                const columns = row.split(';'); // Separar las columnas por ';'

                // Obtener la fecha y la hora de las primeras dos columnas
                const fecha = columns[0];
                const hora = columns[1];

                const estaciones = []; // Usar un array para mantener el orden

                // Procesar las columnas de las estaciones (a partir de la tercera columna)
                for (let i = 2; i < columns.length; i += 2) {
                    const station = header[i].replace(/ok$/i, ''); // Obtener el nombre de la estación de la cabecera
                    const ok = parseInt(columns[i]) || 0; // Piezas OK
                    const nok = parseInt(columns[i + 1]) || 0; // Piezas NOK

                    estaciones.push({
                        station,
                        ok,
                        nok,
                        percent: (ok / (ok + nok)) * 100,
                    });
                }

                // Agregar la entrada con fecha, hora y datos de las estaciones
                resultados.push({
                    fecha,
                    hora,
                    estaciones, // Mantener el array en su orden original
                });
            }

            console.log(`Procesadas ${resultados.length} filas.`);
            res.json(resultados);
        });
    });
});

module.exports = router;