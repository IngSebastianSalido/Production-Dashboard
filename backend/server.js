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
const BACKEND_PORT = String(PORT);

// Middleware CORS: soporta lista por .env y permite frontend en LAN sin IP fija.
const envOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Permite herramientas no-browser o mismo origen sin cabecera Origin.
        if (!origin) return callback(null, true);

        if (envOrigins.includes('*') || envOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Permite dev frontend desde cualquier host de la LAN en puerto 4000
        // y también llamadas desde el mismo puerto del backend.
        try {
            const parsed = new URL(origin);
            const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
            const isDevFrontendPort = parsed.port === '4000';
            const isBackendPort = parsed.port === BACKEND_PORT;

            if (isHttp && (isDevFrontendPort || isBackendPort)) {
                return callback(null, true);
            }
        } catch (e) {
            // Si Origin es inválido, cae en rechazo controlado.
        }

        return callback(new Error(`CORS: origin no permitido (${origin})`));
    },
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Detectar si estamos ejecutando desde pkg o en desarrollo
const isPackaged = process.pkg !== undefined;
const baseDir = isPackaged ? process.cwd() : __dirname;
const dataDir = path.join(baseDir, 'data');

app.use('/static', express.static(dataDir));

// Servir el frontend compilado (Vite build)
const frontendPath = isPackaged 
    ? path.join(process.cwd(), 'produccion-app', 'dist')
    : path.join(__dirname, '..', 'produccion-app', 'dist');

console.log('Frontend path:', frontendPath);
console.log('Frontend exists:', fs.existsSync(frontendPath));

// Helper function to check if a path is accessible and fallback to local if not
function getFilePath(envPath, defaultPath) {
    if (!envPath) {
        return defaultPath;
    }
    
    try {
        const resolvedPath = path.resolve(envPath);
        // Try to access the file to check if network is available
        fs.accessSync(path.dirname(resolvedPath));
        return resolvedPath;
    } catch (err) {
        console.warn(`Network path not accessible: ${envPath}. Falling back to local path: ${defaultPath}`);
        return defaultPath;
    }
}

function areEolCutsCurrent() {
    try {
        const sourcePath = getFilePath(process.env.REA_SOURCE_FILE_PATH, path.join(dataDir, 'ProductionReport.csv'));
        const source = fs.statSync(sourcePath);
        const cuts = fs.statSync(path.join(dataDir, 'EOL_Cuts.csv'));
        const enriched = fs.statSync(path.join(dataDir, 'EOL_Cuts_OEE.csv'));
        return cuts.size > 0 && enriched.size > 128 && cuts.mtimeMs >= source.mtimeMs && enriched.mtimeMs >= source.mtimeMs;
    } catch (err) {
        return false;
    }
}

// Archivos de reportes por timestamp (ProductionReport y HrperHr)
const productionTimestampsPath = getFilePath(
    process.env.PRODUCTION_TIMESTAMPS_FILE_PATH,
    path.join(dataDir, 'ProductionReport.csv')
);
const hrPerHrPath = getFilePath(
    process.env.HRPERHR_FILE_PATH,
    path.join(dataDir, 'HrperHrReport.csv')
);

// Rutas a los archivos CSV (usar defaults dentro de backend/data cuando no está en .env o cuando la red no está disponible)
const productionFilePath = getFilePath(
    process.env.PRODUCTION_FILE_PATH,
    path.join(dataDir, 'ProductionReport.csv')
);

const stopsFilePath = getFilePath(
    process.env.STOPS_FILE_PATH,
    path.join(dataDir, 'paros.csv')
);

const optionsFilePath = getFilePath(
    process.env.OPTIONS_FILE_PATH,
    path.join(baseDir, 'options.json')
);

// Ruta al archivo de categories (si no está en .env, usar backend/categories.json)
const categoriesFilePath = getFilePath(
    process.env.CATEGORIES_FILE_PATH,
    path.join(baseDir, 'categories.json')
);

// Ruta al archivo EOL_Cuts_OEE (contiene eolOk, eolNok y calidad)
const eolCutsFilePath = getFilePath(
    process.env.EOL_CUTS_FILE_PATH,
    path.join(dataDir, 'EOL_Cuts_OEE.csv')
);

// Ruta al archivo de configuración de turnos
const shiftsConfigPath = getFilePath(
    process.env.SHIFTS_CONFIG_PATH,
    path.join(baseDir, 'shifts.json')
);

// Verificar si los archivos CSV existen, si no, crearlos con encabezados
if (!fs.existsSync(productionFilePath)) {
    try {
        fs.writeFileSync(productionFilePath, 'fecha;area;linea;pn;hora;piezas_ok;piezas_nok\n');
    } catch (err) {
        console.error(`Could not create file ${productionFilePath}: ${err.message}`);
    }
}

if (!fs.existsSync(stopsFilePath)) {
    try {
        fs.writeFileSync(stopsFilePath, 'fecha;area;linea;pn;hora_paro;hora_arranque;diferencia_minutos;categoria;estacion;modo_falla;descripcion_modo_falla;descripcion\n');
    } catch (err) {
        console.error(`Could not create file ${stopsFilePath}: ${err.message}`);
    }
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
const parosEstacionRouteFactory = require('./routes/parosEstacion');
const opcionesRouteFactory = require('./routes/opciones');
const categoriesRouteFactory = require('./routes/categoriesRoute');
const reportsTimestampsFactory = require('./routes/reportsTimestamps');
const productionSummaryFactory = require('./routes/productionSummary');
const parosOEERouteFactory = require('./routes/parosOEE');
const parosBatchRouteFactory = require('./routes/parosBatch');
const heijunkaRoute = require('./routes/heijunka');

// Montar rutas
app.use('/api', reaProductionRoute);
app.use('/api', efficiencyRoute);
app.use('/api', reportesRouteFactory(productionFilePath));
app.use('/api', parosRouteFactory(stopsFilePath));
app.use('/api', parosEstacionRouteFactory(stopsFilePath));
app.use('/api', opcionesRouteFactory(optionsFilePath));
app.use('/api', categoriesRouteFactory(categoriesFilePath));
app.use('/api', reportsTimestampsFactory(productionTimestampsPath));
app.use('/api', productionSummaryFactory(productionFilePath, stopsFilePath, eolCutsFilePath, shiftsConfigPath));
app.use('/api', parosOEERouteFactory(stopsFilePath));
app.use('/api', parosBatchRouteFactory(stopsFilePath));
app.use('/api/heijunka', heijunkaRoute);


// Iniciar el servidor HTTP en el host especificado
app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});

// Las rutas para reports desde timestamps fueron movidas a `backend/routes/reportsTimestamps.js`

// ------------------------- RESPALDO AUTOMÁTICO DE PAROS -------------------------
// Configuración por variables de entorno:
// - STOPS_AUTO_BACKUP: (true/false) habilita respaldo automático diario. Default: true
// - STOPS_BACKUP_TIME: HH:mm para la hora local. Default: 23:59
// - STOPS_BACKUP_DIR: directorio destino; si no se define, se usa el mismo directorio del archivo de paros
try {
    const autoBackupEnabled = process.env.STOPS_AUTO_BACKUP === undefined
        ? true
        : String(process.env.STOPS_AUTO_BACKUP).toLowerCase() !== 'false';

    const backupTime = process.env.STOPS_BACKUP_TIME || '23:59';

    // ------------------------- RESPALDO AUTOMÁTICO DE PRODUCTION REPORT -------------------------
    // Configuración por variables de entorno:
    // - PRODUCTION_AUTO_BACKUP: (true/false) habilita respaldo automático diario. Default: true
    // - PRODUCTION_BACKUP_TIME: HH:mm para la hora local. Default: 23:59
    // - PRODUCTION_BACKUP_DIR: directorio destino; si no se define, se usa el mismo directorio del archivo de production
    const productionAutoBackupEnabled = process.env.PRODUCTION_AUTO_BACKUP === undefined
        ? true
        : String(process.env.PRODUCTION_AUTO_BACKUP).toLowerCase() !== 'false';

    const productionBackupTime = process.env.PRODUCTION_BACKUP_TIME || '23:59';

    function ensureDir(dirPath) {
        try {
            if (fs.existsSync(dirPath)) {
                const st = fs.statSync(dirPath);
                if (!st.isDirectory()) throw new Error('Ruta no es directorio');
            } else {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        } catch (e) {
            console.warn('No se pudo preparar directorio de respaldo:', dirPath, '-', e && e.message ? e.message : String(e));
            return false;
        }
    }

    function formatTimestamp(d) {
        const pad = (n) => String(n).padStart(2, '0');
        return [
            d.getFullYear(),
            pad(d.getMonth() + 1),
            pad(d.getDate())
        ].join('-') + '_' + [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join('-');
    }

    function createStopsBackup({ targetDir } = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (!fs.existsSync(stopsFilePath)) {
                    return reject(new Error('Archivo de paros no encontrado'));
                }
                const dir = targetDir || process.env.STOPS_BACKUP_DIR || path.dirname(stopsFilePath);
                if (!ensureDir(dir)) {
                    return reject(new Error('No se pudo preparar el directorio de respaldo'));
                }
                const ext = path.extname(stopsFilePath);
                const base = path.basename(stopsFilePath, ext);
                const backupName = `${base}_${formatTimestamp(new Date())}${ext}`;
                const backupPath = path.join(dir, backupName);
                fs.copyFile(stopsFilePath, backupPath, (err) => {
                    if (err) return reject(err);
                    resolve({ backupName, backupPath });
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    function createProductionBackup({ targetDir } = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (!fs.existsSync(productionFilePath)) {
                    return reject(new Error('Archivo de ProductionReport no encontrado'));
                }
                const dir = targetDir || process.env.PRODUCTION_BACKUP_DIR || path.dirname(productionFilePath);
                if (!ensureDir(dir)) {
                    return reject(new Error('No se pudo preparar el directorio de respaldo'));
                }
                const ext = path.extname(productionFilePath);
                const base = path.basename(productionFilePath, ext);
                const backupName = `${base}_${formatTimestamp(new Date())}${ext}`;
                const backupPath = path.join(dir, backupName);
                fs.copyFile(productionFilePath, backupPath, (err) => {
                    if (err) return reject(err);
                    resolve({ backupName, backupPath });
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    function parseTimeToNextDate(timeStr) {
        // timeStr: 'HH:mm' en hora local
        const [hh, mm] = String(timeStr).split(':').map((v) => parseInt(v, 10));
        if (Number.isNaN(hh) || Number.isNaN(mm)) throw new Error('STOPS_BACKUP_TIME inválido');
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }

    function scheduleNextBackup() {
        try {
            const next = parseTimeToNextDate(backupTime);
            const ms = next.getTime() - Date.now();
            console.log(`Backup de paros programado para: ${next.toString()} (en ${(ms/1000/60).toFixed(1)} min)`);
            setTimeout(async () => {
                try {
                    const { backupPath } = await createStopsBackup();
                    console.log('Respaldo de paros creado automáticamente en', backupPath);
                } catch (e) {
                    console.warn('Fallo al crear respaldo automático de paros:', e && e.message ? e.message : String(e));
                } finally {
                    // Programar el siguiente respaldo tras ejecutar el actual
                    scheduleNextBackup();
                }
            }, ms);
        } catch (e) {
            console.warn('No se pudo programar respaldo automático de paros:', e && e.message ? e.message : String(e));
        }
    }

    function scheduleNextProductionBackup() {
        try {
            const next = parseTimeToNextDate(productionBackupTime);
            const ms = next.getTime() - Date.now();
            console.log(`Backup de ProductionReport programado para: ${next.toString()} (en ${(ms/1000/60).toFixed(1)} min)`);
            setTimeout(async () => {
                try {
                    const { backupPath } = await createProductionBackup();
                    console.log('Respaldo de ProductionReport creado automáticamente en', backupPath);
                } catch (e) {
                    console.warn('Fallo al crear respaldo automático de ProductionReport:', e && e.message ? e.message : String(e));
                } finally {
                    // Programar el siguiente respaldo tras ejecutar el actual
                    scheduleNextProductionBackup();
                }
            }, ms);
        } catch (e) {
            console.warn('No se pudo programar respaldo automático de ProductionReport:', e && e.message ? e.message : String(e));
        }
    }

    if (autoBackupEnabled) {
        scheduleNextBackup();
    } else {
        console.log('STOPS_AUTO_BACKUP=false -> respaldo automático deshabilitado');
    }

    if (productionAutoBackupEnabled) {
        scheduleNextProductionBackup();
    } else {
        console.log('PRODUCTION_AUTO_BACKUP=false -> respaldo automático de ProductionReport deshabilitado');
    }
} catch (e) {
    console.warn('Error al configurar respaldo automático de paros:', e && e.message ? e.message : String(e));
}

// Auto-generate EOL_Cuts.csv and EOL_Cuts_OEE.csv on server start (non-blocking)
// Set AUTO_GENERATE_EOL=false to disable. Default: enabled.
try {
    if ((process.env.AUTO_GENERATE_EOL === undefined || String(process.env.AUTO_GENERATE_EOL).toLowerCase() !== 'false') && !areEolCutsCurrent()) {
        const child_process = require('child_process');
        const scriptPath = path.join(__dirname, 'scripts', 'generate_eol_cuts.js');
        if (fs.existsSync(scriptPath)) {
            // Use Node executable (process.execPath) to run the script so it runs in the same Node version
            const rate = process.env.DEFAULT_RATE_PER_HOUR || '154';
            const args = [scriptPath, `--rate=${rate}`];
            const outLog = path.join(__dirname, 'scripts', 'debug_generate.log');
            const outStream = fs.createWriteStream(outLog, { flags: 'a' });
            outStream.write(`\n[${new Date().toISOString()}] Starting generate_eol_cuts.js with args: ${args.join(' ')}\n`);
            const child = child_process.spawn(process.execPath, args, { cwd: __dirname, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
            child.stdout.pipe(outStream, { end: false });
            child.stderr.pipe(outStream, { end: false });
            child.on('exit', (code) => {
                outStream.write(`\n[${new Date().toISOString()}] generate_eol_cuts.js exited with code ${code}\n`);
                outStream.end();
            });
        } else {
            console.warn('Auto-generation disabled: script generate_eol_cuts.js not found at', path.join(__dirname, 'scripts'));
        }
    } else {
        console.log('EOL_Cuts vigente o AUTO_GENERATE_EOL=false -> se omite la regeneración automática');
    }
} catch (err) {
    console.warn('Error starting auto-generation of EOL cuts:', err && err.message ? err.message : String(err));
}

// Servir archivos estáticos del frontend (debe estar después de todas las rutas API)
app.use(express.static(frontendPath));

// Ruta fallback para React Router (debe ser la última ruta)
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend not found. Make sure produccion-app/dist exists.');
    }
});
