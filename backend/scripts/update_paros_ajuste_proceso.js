const fs = require('fs');
const path = require('path');

// Ruta al archivo de paros
const parosFilePath = path.join(__dirname, '..', 'data', 'paros.csv');

// Leer el archivo CSV
console.log('Leyendo archivo de paros...');
const fileContent = fs.readFileSync(parosFilePath, 'utf-8');
const lines = fileContent.split('\n');

// Procesar líneas
const updatedLines = [];
let updatedCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Saltar líneas vacías
    if (!line) {
        updatedLines.push(line);
        continue;
    }
    
    // Mantener el encabezado
    if (i === 0) {
        updatedLines.push(line);
        continue;
    }
    
    // Parsear la línea
    const parts = line.split(';');
    
    if (parts.length < 13) {
        // Si la línea no tiene suficientes columnas, mantenerla como está
        updatedLines.push(line);
        continue;
    }
    
    // Actualizar la columna ajuste_proceso (índice 13) a "no"
    parts[13] = 'no';
    
    updatedCount++;
    updatedLines.push(parts.join(';'));
}

// Crear backup del archivo original
const backupPath = parosFilePath.replace('.csv', '_ajuste_backup_' + Date.now() + '.csv');
console.log(`Creando backup en: ${backupPath}`);
fs.writeFileSync(backupPath, fileContent);

// Escribir el archivo actualizado
console.log('Escribiendo archivo actualizado...');
fs.writeFileSync(parosFilePath, updatedLines.join('\n'));

console.log('\n=== RESUMEN ===');
console.log(`Total de registros actualizados: ${updatedCount}`);
console.log(`Todos los registros ahora tienen ajuste_proceso = "no"`);
console.log('\n✓ Archivo actualizado exitosamente!');
console.log(`✓ Backup guardado en: ${backupPath}`);
