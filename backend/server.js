const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'DELETE','PUT'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Rutas a los archivos CSV
const productionFilePath = path.resolve(process.env.PRODUCTION_FILE_PATH);
const stopsFilePath = path.resolve(process.env.STOPS_FILE_PATH);
const optionsFilePath = path.resolve(process.env.OPTIONS_FILE_PATH);

// Verificar si los archivos CSV existen, si no, crearlos con encabezados
if (!fs.existsSync(productionFilePath)) {
    fs.writeFileSync(productionFilePath, 'fecha,area,linea,hora,piezas_ok,piezas_nok\n');
}

if (!fs.existsSync(stopsFilePath)) {
    fs.writeFileSync(stopsFilePath, 'fecha,area,linea,estacion,modos_de_fallo,hora_paro,hora_arranque,descripcion\n');
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
    const { fecha, area, linea, estacion, modoFalla, hora_paro, hora_arranque, descripcion } = req.body;

    if (!fecha || !area || !linea || !estacion || !hora_paro || !hora_arranque || !descripcion) {
        return res.status(400).send('Todos los campos son obligatorios, excepto el modo de falla');
    }

    // Leer el archivo CSV de paros
    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de paros:', err);
            return res.status(500).send('No se pudo leer el archivo de paros.');
        }

        const nuevoRegistro = `${fecha},${area},${linea},${estacion},${modoFalla || ''},${hora_paro},${hora_arranque},${descripcion}`;
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
let options = {
    areas: [],
    lineas: [],
    estaciones: [],
    modosFalla: [],
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
    const { type, name, parent, rate, rateDos } = req.body;

    if (!type || !name) {
        return res.status(400).json({ error: 'Type and name are required' });
    }

    if (type === 'areas') {
        options.areas.push({ name });
    } else if (type === 'lineas') {
        if (!parent || rate === undefined || rate === '' || rateDos === undefined || rateDos === '') {
            return res.status(400).json({ error: 'Parent, rate, and rateDos are required for lineas' });
        }
        options.lineas.push({ name, parent, rate, rateDos });
    } else if (type === 'estaciones') {
        if (!parent) {
            return res.status(400).json({ error: 'Parent is required for estaciones' });
        }
        options.estaciones.push({ name, parent });
    } else if (type === 'modosFalla') {
        if (!parent) {
            return res.status(400).json({ error: 'Parent is required for modosFalla' });
        }
        options.modosFalla.push({ name, parent });
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

// Endpoint to modify an option
app.put('/api/opciones/:type/:oldName', (req, res) => {
    const { type, oldName } = req.params;
    const { name } = req.body;

    if (!type || !oldName || !name) {
        return res.status(400).json({ error: 'Type, old name, and new name are required' });
    }

    if (type === 'areas') {
        options.areas = options.areas.map(area => area.name === oldName ? { ...area, name } : area);
        options.lineas = options.lineas.map(linea => linea.parent === oldName ? { ...linea, parent: name } : linea);
        options.estaciones = options.estaciones.map(estacion => estacion.parent === oldName ? { ...estacion, parent: name } : estacion);
        options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: name } : modoFalla);
    } else if (type === 'lineas') {
        options.lineas = options.lineas.map(linea => linea.name === oldName ? { ...linea, name } : linea);
        options.estaciones = options.estaciones.map(estacion => estacion.parent === oldName ? { ...estacion, parent: name } : estacion);
        options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: name } : modoFalla);
    } else if (type === 'estaciones') {
        options.estaciones = options.estaciones.map(estacion => estacion.name === oldName ? { ...estacion, name } : estacion);
        options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: name } : modoFalla);
    } else if (type === 'modosFalla') {
        options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.name === oldName ? { ...modoFalla, name } : modoFalla);
    } else {
        return res.status(400).json({ error: 'Invalid type' });
    }

    saveOptions();
    res.status(200).json({ message: `${type.slice(0, -1)} modified successfully` });
});


// Categorias
categoriesFilePath = path.resolve(process.env.CATEGORIES_FILE_PATH);
// Load categories from file
let categories = [];
if (fs.existsSync(categoriesFilePath)) {
    const data = fs.readFileSync(categoriesFilePath, 'utf8');
    categories = JSON.parse(data).categories;
}

// Endpoint to fetch all categories
app.get('/api/categories', (req, res) => {
    res.json(categories);
});
// ------------------------- INICIAR EL SERVIDOR -------------------------

// Iniciar el servidor HTTP
app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});