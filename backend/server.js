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

// Archivos de reportes por timestamp (ProductionReport y HrperHr)
const productionTimestampsPath = process.env.PRODUCTION_TIMESTAMPS_FILE_PATH
  ? path.resolve(process.env.PRODUCTION_TIMESTAMPS_FILE_PATH)
  : path.join(__dirname, 'data', 'ProductionReport.csv');
const hrPerHrPath = process.env.HRPERHR_FILE_PATH
  ? path.resolve(process.env.HRPERHR_FILE_PATH)
  : path.join(__dirname, 'data', 'HrperHrReport.csv');

// Rutas a los archivos CSV
const productionFilePath = path.resolve(process.env.PRODUCTION_FILE_PATH);
const stopsFilePath = path.resolve(process.env.STOPS_FILE_PATH);
const optionsFilePath = path.resolve(process.env.OPTIONS_FILE_PATH);
// Ruta al archivo de categories (si no está en .env, usar backend/categories.json)
const categoriesFilePath = process.env.CATEGORIES_FILE_PATH
    ? path.resolve(process.env.CATEGORIES_FILE_PATH)
    : path.join(__dirname, 'categories.json');

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

// Las rutas para reportes fueron movidas a `backend/routes/reportes.js`

// Las rutas para paros fueron movidas a `backend/routes/paros.js`

// Las rutas para opciones fueron movidas a `backend/routes/opciones.js`


// Las rutas para categories fueron movidas a `backend/routes/categoriesRoute.js`
// ------------------------- INICIAR EL SERVIDOR -------------------------

// Importar rutas modulares
const reaProductionRoute = require('./routes/reaProduction');
const efficiencyRoute = require('./routes/efficiency');
const reportesRouteFactory = require('./routes/reportes');
const parosRouteFactory = require('./routes/paros');
const opcionesRouteFactory = require('./routes/opciones');
const categoriesRouteFactory = require('./routes/categoriesRoute');
const reportsTimestampsFactory = require('./routes/reportsTimestamps');

// Montar rutas
app.use('/api', reaProductionRoute);
app.use('/api', efficiencyRoute);
app.use('/api', reportesRouteFactory(productionFilePath));
app.use('/api', parosRouteFactory(stopsFilePath));
app.use('/api', opcionesRouteFactory(optionsFilePath));
app.use('/api', categoriesRouteFactory(categoriesFilePath));
app.use('/api', reportsTimestampsFactory(productionTimestampsPath));


// Iniciar el servidor HTTP en el host especificado
app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});

// Las rutas para reports desde timestamps fueron movidas a `backend/routes/reportsTimestamps.js`