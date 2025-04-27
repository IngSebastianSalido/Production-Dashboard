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

router.get('/rea-production-eolo', (req, res) => {
    if (!sourceFilePath) {
        console.error('La ruta de origen del archivo no está configurada en las variables de entorno.');
        return res.status(500).send('La ruta de origen del archivo no está configurada.');
    }

    fs.copyFile(sourceFilePath, reaFilePath, (err) => {
        if (err) {
            console.error('Error al copiar el archivo:', err);
            return res.status(500).send('Error al copiar el archivo.');
        }

        console.log('Archivo copiado exitosamente.');

        fs.readFile(reaFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error leyendo archivo:', err);
                return res.status(500).send('Error leyendo archivo.');
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

                // 🔥 Limpiar la hora
                const cleanHora = rowHora.replace('a. m.', 'AM').replace('p. m.', 'PM').trim();
                const fechaHoraString = `${rowFecha} ${cleanHora}`;
                const fechaHoraObj = new Date(fechaHoraString);

                if (isNaN(fechaHoraObj)) {
                    console.error(`Fecha inválida encontrada: ${fechaHoraString}`);
                    continue;
                }

                const horaFormateada = fechaHoraObj.toTimeString().split(' ')[0]; // hh:mm:ss

                const eolOk = parseInt(columns[eoloIndex]) || 0;

                registros.push({
                    fecha: rowFecha,
                    horaCompleta: horaFormateada,
                    piezasAcumuladas: eolOk,
                    fechaHoraReal: fechaHoraObj
                });
            }

            // ✅ Ordenar por fecha real
            registros.sort((a, b) => a.fechaHoraReal - b.fechaHoraReal);

            const diferencias = [];

            let acumuladoAnterior = 0;

            for (let i = 0; i < registros.length; i++) {
                const actual = registros[i];

                let diferencia = 0;

                if (actual.piezasAcumuladas === 0) {
                    // 🔥 Si el acumulado es 0, no confiamos en él, guardamos diferencia como 0
                    diferencia = 0;
                } else {
                    if (actual.piezasAcumuladas >= acumuladoAnterior) {
                        diferencia = actual.piezasAcumuladas - acumuladoAnterior;
                    } else {
                        // 🔥 Reset, tomamos el valor actual directamente
                        diferencia = actual.piezasAcumuladas;
                    }
                    acumuladoAnterior = actual.piezasAcumuladas; // 🔥 Solo actualizamos si no fue cero
                }

                diferencias.push({
                    fecha: actual.fecha,
                    hora: actual.horaCompleta,
                    piezasProducidas: diferencia
                });
            }

            // 🔥 Crear carpeta si no existe
            const outputFolder = path.join(__dirname, '../data');
            if (!fs.existsSync(outputFolder)) {
                fs.mkdirSync(outputFolder, { recursive: true });
            }

            // 🔥 Guardar CSV
            const reportPath = path.join(outputFolder, 'HrperHrReport.csv');
            const csvHeader = 'Fecha,Hora,PiezasProducidas\n';
            const csvContent = diferencias.map(dif => `${dif.fecha},${dif.hora},${dif.piezasProducidas}`).join('\n');
            const fullCsv = csvHeader + csvContent;

            fs.writeFile(reportPath, fullCsv, 'utf8', (err) => {
                if (err) {
                    console.error('Error escribiendo archivo CSV:', err);
                    return res.status(500).send('Error escribiendo archivo CSV.');
                }

                console.log(`Archivo CSV generado correctamente en: ${reportPath}`);
                res.json({ message: 'Datos procesados (ignorando ceros) y CSV generado exitosamente.', diferencias });
            });
        });
    });
});

router.get('/rea-production-eolo-graph', (req, res) => {
    const { fecha } = req.query;

    if (!fecha) {
        return res.status(400).send('Se requiere el parámetro fecha en formato YYYY-MM-DD.');
    }

    const csvPath = path.join(__dirname, '../data/HrperHrReport.csv');

    fs.readFile(csvPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error leyendo HrperHrReport.csv:', err);
            return res.status(500).send('Error leyendo el archivo CSV.');
        }

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
                const horaSolo = horaCompleta.split(':')[0] + ":00"; // 🔥 Solo la hora redondeada a hora:00
                registros.push({
                    hora: horaSolo,
                    piezasProducidas
                });
            }
        }

        // 🔥 Agrupar y sumar por hora
        const datosPorHora = {};

        for (const registro of registros) {
            if (!datosPorHora[registro.hora]) {
                datosPorHora[registro.hora] = 0;
            }
            datosPorHora[registro.hora] += registro.piezasProducidas;
        }

        // 🔥 Convertir a array ordenado
        const datosOrdenados = Object.keys(datosPorHora).sort((a, b) => {
            const horaA = parseInt(a.split(':')[0]);
            const horaB = parseInt(b.split(':')[0]);
            return horaA - horaB;
        }).map(hora => ({
            hora,
            piezasProducidas: datosPorHora[hora]
        }));

        res.json(datosOrdenados);
    });
});

module.exports = router;