const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
const corsOptions = {
    origin: ['http://localhost:4000', 'http://192.168.68.165:4000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Rutas a los archivos CSV
const productionFilePath = path.join('C:/Users/salid/Desktop/DB', 'produccion.csv');
const stopsFilePath = path.join('C:/Users/salid/Desktop/DB', 'paros.csv'); // Nuevo archivo para los paros

// Verificar si los archivos CSV existen, si no, crearlos con encabezados
if (!fs.existsSync(productionFilePath)) {
    fs.writeFileSync(productionFilePath, 'fecha,area,linea,hora,piezas_ok,piezas_nok\n');
}

if (!fs.existsSync(stopsFilePath)) {
    fs.writeFileSync(stopsFilePath, 'area,linea,estacion,hora_paro,hora_arranque,descripcion\n');
}

// Logger para verificar las solicitudes
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// ------------------------- ENDPOINTS PARA REPORTES -------------------------

// Endpoint para guardar o actualizar un reporte de producción
app.post('/api/reportes', (req, res) => {
    const { fecha, area, linea, hora, piezas_ok, piezas_nok } = req.body;

    if (!fecha || !area || !linea || !hora || piezas_ok === undefined || piezas_nok === undefined) {
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

        // Buscar si ya existe un registro con la misma fecha, área, línea y hora
        const index = registros.findIndex(row => {
            const cols = row.split(',');
            return cols.length === 6 && cols[0] === fecha && cols[1] === area && cols[2] === linea && cols[3] === hora;
        });

        const nuevoRegistro = `${fecha},${area},${linea},${hora},${piezas_ok},${piezas_nok}`;

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

// Endpoint para obtener reportes por fecha y área
app.get('/api/reportes/:fecha/:area', (req, res) => {
    const { fecha, area } = req.params;

    fs.readFile(productionFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de producción:', err);
            return res.status(500).send('No se pudo leer el archivo de producción.');
        }

        const reportes = data
            .split('\n')
            .slice(1)
            .filter(line => {
                const cols = line.split(',');
                return cols.length === 6 && cols[0] === fecha && cols[1].toLowerCase() === area.toLowerCase();
            })
            .map(line => line.split(',')) // Convertir cada línea en un array
            .sort((a, b) => a[3].localeCompare(b[3])); // Ordenar por hora

        res.json(reportes);
    });
});

// ------------------------- ENDPOINTS PARA PAROS -------------------------

// Endpoint para registrar un paro de línea
app.post('/api/paros', (req, res) => {
    const { area, linea, estacion, hora_paro, hora_arranque, descripcion } = req.body;

    if (!area || !linea || !estacion || !hora_paro || !hora_arranque || !descripcion) {
        return res.status(400).send('Todos los campos son obligatorios');
    }

    // Leer el archivo CSV de paros
    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de paros:', err);
            return res.status(500).send('No se pudo leer el archivo de paros.');
        }

        const nuevoRegistro = `${area},${linea},${estacion},${hora_paro},${hora_arranque},${descripcion}`;
        const contenidoActualizado = data.trim() + '\n' + nuevoRegistro;

        // Guardar el nuevo paro en el archivo CSV
        fs.writeFile(stopsFilePath, contenidoActualizado, (err) => {
            if (err) {
                console.error('Error al guardar el paro:', err);
                return res.status(500).send('Error al guardar el paro.');
            }
            res.send('Paro registrado correctamente');
        });
    });
});

// Endpoint para obtener los paros registrados
app.get('/api/paros', (req, res) => {
    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de paros:', err);
            return res.status(500).send('No se pudo leer el archivo de paros.');
        }

        const paros = data
            .split('\n')
            .slice(1)
            .filter(line => line.trim() !== '')
            .map(line => line.split(',')); // Convertir cada línea en un array

        res.json(paros);
    });
});

// ------------------------- INICIAR EL SERVIDOR -------------------------

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
