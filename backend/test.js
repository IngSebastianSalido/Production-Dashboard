const fs = require('fs');
const path = require('path');

// Ajusta las rutas hacia los archivos key.pem y cert.pem
const keyPath = path.resolve(__dirname, '../certs/key.pem');
const certPath = path.resolve(__dirname, '../certs/cert.pem');

try {
    const key = fs.readFileSync(keyPath, 'utf8');
    const cert = fs.readFileSync(certPath, 'utf8');
    console.log('Archivos leídos correctamente');
} catch (err) {
    console.error(`Error al leer los archivos:\n${keyPath}\n${certPath}`);
    console.error(err);
}
