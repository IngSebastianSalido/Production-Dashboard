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
// Escuchar en todas las interfaces si no se especifica un HOST
const HOST = process.env.HOST || '0.0.0.0';

// Middleware: permitir CORS desde cualquier origen en desarrollo
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use('/static', express.static(path.join(__dirname, 'data')));


// Rutas a los archivos CSV
const productionFilePath = path.resolve(process.env.PRODUCTION_FILE_PATH);
const stopsFilePath = path.resolve(process.env.STOPS_FILE_PATH);
const optionsFilePath = path.resolve(process.env.OPTIONS_FILE_PATH);

// Verificar si los archivos CSV existen, si no, crearlos con encabezados
if (!fs.existsSync(productionFilePath)) {
    fs.writeFileSync(productionFilePath, 'fecha;area;linea;pn;hora;piezas_ok;piezas_nok\n');
}

if (!fs.existsSync(stopsFilePath)) {
    fs.writeFileSync(stopsFilePath, 'fecha;area;linea;pn;hora_paro;hora_arranque;diferencia_minutos;estacion;modo_falla;descripcion_modo_falla;descripcion;categoria\n');
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
app.get('/api/reportes/:fecha/:area/:linea/:pn', (req, res) => {
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
                const cols = line.split(';');
                return cols.length === 7 && cols[0] === fecha;
            })
            .map(line => line.split(';')) // Convertir cada línea en un array
            .sort((a, b) => a[4].localeCompare(b[4])); // Ordenar por hora

        res.json(reportes);
    });
});

// ------------------------- ENDPOINTS PARA PAROS -------------------------
// Endpoint para registrar un paro de línea
app.post('/api/paros', (req, res) => {
    const {
        fecha,
        area,
        linea,
        pn,
        estacion,
        modoFalla = '', // Valor predeterminado
        descripcionModoFalla = '', // Valor predeterminado
        hora_paro,
        hora_arranque,
        descripcion,
        categoria,
        cruza_medianoche = false, // Nuevo campo
        fecha_arranque, // Fecha de arranque cuando cruza medianoche
    } = req.body;

    console.log("Datos recibidos en el backend (POST /api/paros):", req.body);

    if (!fecha || !area || !linea || !pn || !estacion || !hora_paro || !hora_arranque || !descripcion || !categoria) {
        return res.status(400).send('Todos los campos son obligatorios, excepto el modo de falla y su descripción');
    }

    // Calcular la diferencia de tiempo en minutos
    let diferenciaMinutos;
    
    if (cruza_medianoche) {
        // Cuando cruza medianoche, calcular la diferencia considerando el cambio de día
        const horaParoDate = new Date(`1970-01-01T${hora_paro}:00Z`);
        const horaArranqueDate = new Date(`1970-01-02T${hora_arranque}:00Z`); // Día siguiente
        diferenciaMinutos = Math.round((horaArranqueDate - horaParoDate) / 60000);
    } else {
        // Mismo día
        const horaParoDate = new Date(`1970-01-01T${hora_paro}:00Z`);
        const horaArranqueDate = new Date(`1970-01-01T${hora_arranque}:00Z`);
        diferenciaMinutos = Math.round((horaArranqueDate - horaParoDate) / 60000);
    }
    
    // Validar que el tiempo de paro no sea negativo
    if (diferenciaMinutos <= 0) {
        return res.status(400).send('El tiempo de paro no puede ser negativo o cero. Verifica las horas ingresadas.');
    }

    // Leer el archivo CSV de paros
    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de paros:', err);
            return res.status(500).send('No se pudo leer el archivo de paros.');
        }

        let registrosToAdd = [];
        
        if (cruza_medianoche) {
            // Para paros que cruzan medianoche, crear dos registros:
            // 1. Registro del día inicial (desde hora_paro hasta 23:59)
            // 2. Registro del día siguiente (desde 00:00 hasta hora_arranque)
            
            const [horaParoHour, horaParoMin] = hora_paro.split(':').map(Number);
            const [horaArranqueHour, horaArranqueMin] = hora_arranque.split(':').map(Number);
            
            // Calcular minutos del primer día (desde hora_paro hasta medianoche)
            const minutosHastaMedianoche = (23 * 60 + 59) - (horaParoHour * 60 + horaParoMin) + 1;
            
            // Calcular minutos del segundo día (desde medianoche hasta hora_arranque)
            const minutosDesdeMedianoche = horaArranqueHour * 60 + horaArranqueMin;
            
            // Registro del primer día
            const comentarioMedianoche1 = ' [Paro cruza medianoche - Parte 1]';
            const registro1 = `${fecha};${area};${linea};${pn};${hora_paro};23:59;${minutosHastaMedianoche};${categoria};${estacion};${modoFalla || ''};${descripcionModoFalla || ''};${descripcion}${comentarioMedianoche1}`;
            
            // Registro del segundo día
            const fechaArranque = fecha_arranque || (() => {
                const fechaSiguiente = new Date(fecha);
                fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
                return fechaSiguiente.toLocaleDateString('en-CA');
            })();
            
            const comentarioMedianoche2 = ' [Paro cruza medianoche - Parte 2]';
            const registro2 = `${fechaArranque};${area};${linea};${pn};00:00;${hora_arranque};${minutosDesdeMedianoche};${categoria};${estacion};${modoFalla || ''};${descripcionModoFalla || ''};${descripcion}${comentarioMedianoche2}`;
            
            registrosToAdd = [registro1, registro2];
        } else {
            // Paro normal del mismo día
            const nuevoRegistro = `${fecha};${area};${linea};${pn};${hora_paro};${hora_arranque};${diferenciaMinutos};${categoria};${estacion};${modoFalla || ''};${descripcionModoFalla || ''};${descripcion}`;
            registrosToAdd = [nuevoRegistro];
        }

        // Agregar todos los registros al archivo
        const contenidoActualizado = data.trim() + '\n' + registrosToAdd.join('\n');

        // Guardar el nuevo paro en el archivo CSV
        fs.writeFile(stopsFilePath, contenidoActualizado, (err) => {
            if (err) {
                console.error('Error al guardar el paro:', err);
                return res.status(500).send('Error al guardar el paro.');
            }
            console.log("Registros guardados correctamente:", registrosToAdd);
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
            .map(line => line.split(';')); // Convertir cada línea en un array

        res.json(paros);
    });
});

// Endpoint para eliminar un paro
app.delete('/api/paros', (req, res) => {
    const { fecha, area, linea, pn, hora_paro } = req.body;

    if (!fecha || !area || !linea || !pn || !hora_paro) {
        return res.status(400).send('Todos los campos son obligatorios para eliminar un paro');
    }

    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer el archivo de paros:', err);
            return res.status(500).send('No se pudo leer el archivo de paros.');
        }

        const rows = data.split('\n');
        const headers = rows[0];
        const registros = rows.slice(1).filter(row => row.trim() !== '');

        // Filtrar los registros para eliminar el que coincide con los datos proporcionados
        const registrosActualizados = registros.filter(row => {
            const cols = row.split(';');
            return !(cols[0] === fecha && cols[1] === area && cols[2] === linea && cols[3] === pn && cols[4] === hora_paro);
        });

        const nuevoContenido = [headers, ...registrosActualizados].join('\n');
        fs.writeFile(stopsFilePath, nuevoContenido, (err) => {
            if (err) {
                console.error('Error al guardar los cambios:', err);
                return res.status(500).send('Error al guardar los cambios.');
            }
            res.send('Paro eliminado correctamente');
        });
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
    const { type, name, parent, rate, rateDos, pn, descripcionModoFalla } = req.body;

    if (!type || !name) {
        return res.status(400).json({ error: 'Type and name are required' });
    }

    if (type === 'areas') {
        options.areas.push({ name });
    } else if (type === 'lineas') {
        if (!parent || rate === undefined || rate === '' || rateDos === undefined || rateDos === '' || pn === undefined || pn === '') {
            return res.status(400).json({ error: 'Parent, rate, rateDos, and PN are required for lineas' });
        }
        options.lineas.push({ name, parent, rate, rateDos, pn });
    } else if (type === 'estaciones') {
        if (!parent) {
            return res.status(400).json({ error: 'Parent is required for estaciones' });
        }
        options.estaciones.push({ name, parent });
    } else if (type === 'modosFalla') {
        if (!parent) {
            return res.status(400).json({ error: 'Parent is required for modosFalla' });
        }
        options.modosFalla.push({ name, parent, descripcionModoFalla });
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

// Importar la nueva ruta
const reaProductionRoute = require('./routes/reaProduction');
const efficiencyRoute = require('./routes/efficiency');
app.use('/api', reaProductionRoute);
app.use('/api', efficiencyRoute);


// Iniciar el servidor HTTP en el host especificado
app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});