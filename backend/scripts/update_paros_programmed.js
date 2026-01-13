const fs = require('fs');
const path = require('path');

// Ruta al archivo de paros
const parosFilePath = path.join(__dirname, '..', 'data', 'paros.csv');

// Categorías y descripciones que se consideran PROGRAMADAS
const programmedCategories = [
    'Mantenimiento',
    'Material/Logística',
];

const programmedDescriptions = [
    'Change Over',
    'Cambio de turno',
    'Checklist',
    'Setup',
    'Liberacion calidad',
    'Esperando liberacion',
];

// Leer el archivo CSV
console.log('Leyendo archivo de paros...');
const fileContent = fs.readFileSync(parosFilePath, 'utf-8');
const lines = fileContent.split('\n');

// Procesar líneas
const updatedLines = [];
let programmedCount = 0;
let notProgrammedCount = 0;

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
    
    if (parts.length < 12) {
        // Si la línea no tiene suficientes columnas, mantenerla como está
        updatedLines.push(line);
        continue;
    }
    
    const categoria = parts[7] || '';
    const descripcion = parts[11] || '';
    
    // Determinar si es programado
    let isProgrammed = false;
    
    // Verificar por categoría
    if (programmedCategories.some(cat => categoria.includes(cat))) {
        isProgrammed = true;
    }
    
    // Verificar por descripción
    if (programmedDescriptions.some(desc => descripcion.toLowerCase().includes(desc.toLowerCase()))) {
        isProgrammed = true;
    }
    
    // Actualizar la última columna
    parts[12] = isProgrammed ? 'si' : 'no';
    
    if (isProgrammed) {
        programmedCount++;
    } else {
        notProgrammedCount++;
    }
    
    updatedLines.push(parts.join(';'));
}

// Crear backup del archivo original
const backupPath = parosFilePath.replace('.csv', '_backup_' + Date.now() + '.csv');
console.log(`Creando backup en: ${backupPath}`);
fs.writeFileSync(backupPath, fileContent);

// Escribir el archivo actualizado
console.log('Escribiendo archivo actualizado...');
fs.writeFileSync(parosFilePath, updatedLines.join('\n'));

console.log('\n=== RESUMEN ===');
console.log(`Total de líneas procesadas: ${lines.length - 1}`);
console.log(`Paros PROGRAMADOS: ${programmedCount}`);
console.log(`Paros NO PROGRAMADOS: ${notProgrammedCount}`);
console.log('\n✓ Archivo actualizado exitosamente!');
console.log(`✓ Backup guardado en: ${backupPath}`);
