// Script de prueba para los endpoints de paros-OEE
const fs = require('fs');
const path = require('path');

console.log('\n🧪 PRUEBA DE FUNCIONALIDAD PAROS-OEE\n');

// 1. Verificar archivo de paros
const parosPath = path.join(__dirname, 'data', 'paros.csv');
if (!fs.existsSync(parosPath)) {
  console.log('❌ Archivo paros.csv no encontrado');
  process.exit(1);
}

const parosRaw = fs.readFileSync(parosPath, 'utf8');
const parosRows = parosRaw.split('\n').filter(r => r.trim() !== '');
console.log(`✅ Archivo paros.csv encontrado: ${parosRows.length - 1} registros`);

// 2. Verificar archivo EOL_Cuts.csv
const eolCutsPath = path.join(__dirname, 'data', 'EOL_Cuts.csv');
if (!fs.existsSync(eolCutsPath)) {
  console.log('❌ Archivo EOL_Cuts.csv no encontrado');
  process.exit(1);
}

const eolCutsRaw = fs.readFileSync(eolCutsPath, 'utf8');
const eolCutsRows = eolCutsRaw.split('\n').filter(r => r.trim() !== '');
console.log(`✅ Archivo EOL_Cuts.csv encontrado: ${eolCutsRows.length - 1} registros`);

// Mostrar algunos batch IDs
console.log('\n📋 Ejemplos de Batch IDs en EOL_Cuts.csv:');
for (let i = 1; i <= Math.min(5, eolCutsRows.length - 1); i++) {
  const cols = eolCutsRows[i].split(',');
  console.log(`   ${i}. ${cols[0]} - PN: ${cols[7]} - Start: ${cols[2]}`);
}

// 3. Verificar archivo EOL_Cuts_OEE.csv
const oeePath = path.join(__dirname, 'data', 'EOL_Cuts_OEE.csv');
if (!fs.existsSync(oeePath)) {
  console.log('\n⚠️  Archivo EOL_Cuts_OEE.csv no encontrado');
  console.log('   Ejecuta: GET /api/rea-production-eolo-cuts-oee para generarlo');
  process.exit(0);
}

const oeeRaw = fs.readFileSync(oeePath, 'utf8');
const oeeRows = oeeRaw.split('\n').filter(r => r.trim() !== '');
console.log(`\n✅ Archivo EOL_Cuts_OEE.csv encontrado: ${oeeRows.length - 1} registros`);

if (oeeRows.length <= 1) {
  console.log('\n⚠️  El archivo EOL_Cuts_OEE.csv está vacío');
  console.log('   Ejecuta: GET /api/rea-production-eolo-cuts-oee para generarlo');
  process.exit(0);
}

// 4. Probar asociación de un paro con batch
console.log('\n🔗 PRUEBA DE ASOCIACIÓN:');
console.log('─'.repeat(80));

// Parsear primer paro
const parosCols = parosRows[1].split(';');
const fechaParo = parosCols[0];
const horaParo = parosCols[4];
console.log(`\n📍 Paro de ejemplo:`);
console.log(`   Fecha: ${fechaParo}`);
console.log(`   Hora: ${horaParo}`);
console.log(`   Estación: ${parosCols[8]}`);

// Convertir a Date
const parts = fechaParo.split('/');
if (parts.length === 3) {
  const [month, day, year] = parts;
  const fechaParoDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  const [horasP, minutosP] = horaParo.split(':').map(x => parseInt(x) || 0);
  fechaParoDate.setHours(horasP, minutosP, 0, 0);
  
  console.log(`   Timestamp: ${fechaParoDate.toISOString()}`);
  
  // Buscar batch correspondiente
  console.log(`\n🔍 Buscando batch correspondiente...`);
  
  // Crear mapa de batch IDs
  const batchIdMap = new Map();
  for (let i = 1; i < eolCutsRows.length; i++) {
    const line = eolCutsRows[i];
    const cols = [];
    let currentCol = '';
    let insideQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        cols.push(currentCol);
        currentCol = '';
      } else {
        currentCol += char;
      }
    }
    cols.push(currentCol);
    
    if (cols.length >= 3) {
      const batchId = cols[0];
      const startISO = cols[2];
      batchIdMap.set(startISO, batchId);
    }
  }
  
  // Buscar en OEE batches
  let encontrado = false;
  for (let i = 1; i < oeeRows.length && !encontrado; i++) {
    const line = oeeRows[i];
    const cols = [];
    let currentCol = '';
    let insideQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        cols.push(currentCol);
        currentCol = '';
      } else {
        currentCol += char;
      }
    }
    cols.push(currentCol);
    
    if (cols.length < 10) continue;
    
    const startISO = cols[0];
    const endISO = cols[1];
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    
    if (fechaParoDate >= startDate && fechaParoDate <= endDate) {
      const realBatchId = batchIdMap.get(startISO) || `BATCH_${i}`;
      console.log(`\n✅ ¡BATCH ENCONTRADO!`);
      console.log(`   Batch ID: ${realBatchId}`);
      console.log(`   Start: ${startISO}`);
      console.log(`   End: ${endISO}`);
      console.log(`   PN: ${cols[2]}`);
      console.log(`   Piezas: ${cols[3]}`);
      console.log(`   OEE: ${(parseFloat(cols[10]) * parseFloat(cols[11]) * parseFloat(cols[12]) * 100).toFixed(2)}%`);
      encontrado = true;
    }
  }
  
  if (!encontrado) {
    console.log(`\n⚠️  No se encontró batch para este paro`);
    console.log(`   El paro está fuera del rango de los batches OEE disponibles`);
  }
}

console.log('\n' + '─'.repeat(80));
console.log('\n✅ Prueba completada\n');
console.log('📝 Para probar los endpoints:');
console.log('   1. Asegúrate de que el servidor esté corriendo');
console.log('   2. Genera datos OEE: GET /api/rea-production-eolo-cuts-oee');
console.log('   3. Descarga Excel: GET /api/paros-oee-excel');
console.log('   4. Obtén JSON: GET /api/paros-oee-json\n');
