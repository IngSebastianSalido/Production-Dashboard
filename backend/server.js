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
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Rutas a los archivos CSV
const productionFilePath = path.join('C:/Users/salid/Desktop/DB', 'produccion.csv');
const stopsFilePath = path.join('C:/Users/salid/Desktop/DB', 'paros.csv');

// Verificar si los archivos CSV existen, si no, crearlos con encabezados
if (!fs.existsSync(productionFilePath)) {
    fs.writeFileSync(productionFilePath, 'fecha,area,linea,hora,piezas_ok,piezas_nok\n');
}

if (!fs.existsSync(stopsFilePath)) {
    fs.writeFileSync(stopsFilePath, 'fecha,area,linea,estacion,hora_paro,hora_arranque,descripcion\n');
}

// Logger para verificar las solicitudes
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// ------------------------- ENDPOINTS -------------------------

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

// Endpoint para obtener reportes por fecha, área y línea
app.get('/api/reportes/:fecha/:area/:linea', (req, res) => {
    const { fecha, area, linea } = req.params;

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
                return cols.length === 6 && cols[0] === fecha && cols[1].toLowerCase() === area.toLowerCase() && cols[2].toLowerCase() === linea.toLowerCase();
            })
            .map(line => line.split(',')) // Convertir cada línea en un array
            .sort((a, b) => a[3].localeCompare(b[3])); // Ordenar por hora

        res.json(reportes);
    });
});

// Endpoint para obtener reportes por fecha (todas las áreas y líneas)
app.get('/api/reportes/:fecha', (req, res) => {
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
                const cols = line.split(',');
                return cols.length === 6 && cols[0] === fecha;
            })
            .map(line => line.split(',')) // Convertir cada línea en un array
            .sort((a, b) => a[3].localeCompare(b[3])); // Ordenar por hora

        res.json(reportes);
    });
});

// ------------------------- ENDPOINTS PARA PAROS -------------------------

// Endpoint para registrar un paro de línea
app.post('/api/paros', (req, res) => {
    const { fecha, area, linea, estacion, hora_paro, hora_arranque, descripcion } = req.body;

    if (!fecha || !area || !linea || !estacion || !hora_paro || !hora_arranque || !descripcion) {
        return res.status(400).send('Todos los campos son obligatorios');
    }

    // Leer el archivo CSV de paros
    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de paros:', err);
            return res.status(500).send('No se pudo leer el archivo de paros.');
        }

        const nuevoRegistro = `${fecha},${area},${linea},${estacion},${hora_paro},${hora_arranque},${descripcion}`;
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

// END POINTS PARA OPCIONES
const optionsFilePath = path.join(__dirname, 'options.json');
let options = {
    areas: [],
    lineas: [],
    estaciones: [],
};

// Load options from file
const loadOptions = () => {
    if (fs.existsSync(optionsFilePath)) {
        const data = fs.readFileSync(optionsFilePath, 'utf8');
        options = JSON.parse(data);
    }
};

// Save options to file
const saveOptions = () => {
    fs.writeFileSync(optionsFilePath, JSON.stringify(options, null, 2), 'utf8');
};

// Load options when the server starts
loadOptions();

// Endpoint to fetch all options
app.get('/api/opciones', (req, res) => {
    res.json(options);
});

// Endpoint to add a new option
app.post('/api/opciones', (req, res) => {
    const { type, name, parent } = req.body;

    if (!type || !name) {
        return res.status(400).json({ error: 'Type and name are required' });
    }

    if (type === 'areas') {
        options.areas.push({ name });
    } else if (type === 'lineas') {
        if (!parent) {
            return res.status(400).json({ error: 'Parent is required for lineas' });
        }
        options.lineas.push({ name, parent });
    } else if (type === 'estaciones') {
        if (!parent) {
            return res.status(400).json({ error: 'Parent is required for estaciones' });
        }
        options.estaciones.push({ name, parent });
    } else {
        return res.status(400).json({ error: 'Invalid type' });
    }

    saveOptions();
    res.status(201).json({ message: `${type.slice(0, -1)} added successfully` });
});

// Endpoint to remove an option
app.delete('/api/opciones/:type/:name', (req, res) => {
    const { type, name } = req.params;

    if (!type || !name) {
        return res.status(400).json({ error: 'Type and name are required' });
    }

    if (type === 'areas') {
        options.areas = options.areas.filter(area => area.name !== name);
        options.lineas = options.lineas.filter(linea => linea.parent !== name);
        options.estaciones = options.estaciones.filter(estacion => estacion.parent !== name);
    } else if (type === 'lineas') {
        options.lineas = options.lineas.filter(linea => linea.name !== name);
        options.estaciones = options.estaciones.filter(estacion => estacion.parent !== name);
    } else if (type === 'estaciones') {
        options.estaciones = options.estaciones.filter(estacion => estacion.name !== name);
    } else {
        return res.status(400).json({ error: 'Invalid type' });
    }

    saveOptions();
    res.status(200).json({ message: `${type.slice(0, -1)} removed successfully` });
});

// ------------------------- INICIAR EL SERVIDOR -------------------------

// Iniciar el servidor HTTP
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://192.168.68.165:${PORT}`);
});