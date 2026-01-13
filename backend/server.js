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

// Rutas a los archivos CSV (usar defaults dentro de backend/data cuando no está en .env)
const productionFilePath = process.env.PRODUCTION_FILE_PATH
    ? path.resolve(process.env.PRODUCTION_FILE_PATH)
    : path.join(__dirname, 'data', 'ProductionReport.csv');

const stopsFilePath = process.env.STOPS_FILE_PATH
    ? path.resolve(process.env.STOPS_FILE_PATH)
    : path.join(__dirname, 'data', 'paros.csv');

const optionsFilePath = process.env.OPTIONS_FILE_PATH
    ? path.resolve(process.env.OPTIONS_FILE_PATH)
    : path.join(__dirname, 'options.json');
// Ruta al archivo de categories (si no está en .env, usar backend/categories.json)
const categoriesFilePath = process.env.CATEGORIES_FILE_PATH
    ? path.resolve(process.env.CATEGORIES_FILE_PATH)
    : path.join(__dirname, 'categories.json');

// Ruta al archivo EOL_Cuts_OEE (contiene eolOk, eolNok y calidad)
const eolCutsFilePath = process.env.EOL_CUTS_FILE_PATH
    ? path.resolve(process.env.EOL_CUTS_FILE_PATH)
    : path.join(__dirname, 'data', 'EOL_Cuts_OEE.csv');

// Ruta al archivo de configuración de turnos
const shiftsConfigPath = process.env.SHIFTS_CONFIG_PATH
    ? path.resolve(process.env.SHIFTS_CONFIG_PATH)
    : path.join(__dirname, 'shifts.json');

// Verificar si los archivos CSV existen, si no, crearlos con encabezados
if (!fs.existsSync(productionFilePath)) {
    fs.writeFileSync(productionFilePath, 'fecha;area;linea;pn;hora;piezas_ok;piezas_nok\n');
}

if (!fs.existsSync(stopsFilePath)) {
    fs.writeFileSync(stopsFilePath, 'fecha;area;linea;pn;hora_paro;hora_arranque;diferencia_minutos;categoria;estacion;modo_falla;descripcion_modo_falla;descripcion\n');
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
    if (process.env.AUTO_GENERATE_EOL === undefined || String(process.env.AUTO_GENERATE_EOL).toLowerCase() !== 'false') {
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
        console.log('AUTO_GENERATE_EOL=false -> skipping automatic generation of EOL_Cuts');
    }
} catch (err) {
    console.warn('Error starting auto-generation of EOL cuts:', err && err.message ? err.message : String(err));
}
