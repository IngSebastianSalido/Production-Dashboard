const fs = require('fs');
const path = require('path');

// Fix malformed rows in paros.csv caused by newline/semicolon in text fields.
// Usage: node scripts/fix_paros.js
// Optional: set STOPS_FILE_PATH to target another file.

function sanitizeText(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, ',')
    .trim();
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-') + '_' + [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join('-');
}

function main() {
  const stopsFile = process.env.STOPS_FILE_PATH
    ? path.resolve(process.env.STOPS_FILE_PATH)
    : path.join(__dirname, '..', 'data', 'paros.csv');

  if (!fs.existsSync(stopsFile)) {
    console.error('No se encontró el archivo:', stopsFile);
    process.exit(1);
  }

  const backupPath = `${stopsFile.replace(/\.csv$/i, '')}_${timestamp()}.csv`;
  fs.copyFileSync(stopsFile, backupPath);
  console.log('Respaldo creado en', backupPath);

  const raw = fs.readFileSync(stopsFile, 'utf8');
  const lines = raw.split(/\r?\n/);
  const header = lines.shift();

  let lastRow = null;
  const fixedRows = [];
  let appended = 0;
  let skipped = 0;
  let truncated = 0;

  for (const line of lines) {
    if (!line || !line.trim()) continue;

    const parts = line.split(';');

    if (parts.length === 14) {
      fixedRows.push(parts);
      lastRow = parts;
      continue;
    }

    // If the row has fewer columns, assume it belongs to descripcion of lastRow
    if (parts.length < 14) {
      if (!lastRow) {
        skipped += 1;
        continue;
      }
      const extra = sanitizeText(line);
      lastRow[11] = sanitizeText(lastRow[11] || '') + (extra ? ` ${extra}` : '');
      if (!lastRow[12]) lastRow[12] = 'No';
      if (!lastRow[13]) lastRow[13] = 'No';
      appended += 1;
      continue;
    }

    // If the row has more columns, keep the first 14 and merge the rest into descripcion
    if (parts.length > 14) {
      const base = parts.slice(0, 14);
      const extraText = sanitizeText(parts.slice(14).join(' '));
      base[11] = sanitizeText(base[11] || '') + (extraText ? ` ${extraText}` : '');
      fixedRows.push(base);
      lastRow = base;
      truncated += 1;
      continue;
    }
  }

  const output = [header, ...fixedRows.map(row => row.map(sanitizeText).join(';'))].join('\n') + '\n';
  fs.writeFileSync(stopsFile, output, 'utf8');

  console.log('Filas totales:', fixedRows.length);
  console.log('Filas reparadas (append a descripcion):', appended);
  console.log('Filas truncadas (>14 columnas):', truncated);
  console.log('Filas descartadas sin contexto:', skipped);
  console.log('Listo.');
}

main();
