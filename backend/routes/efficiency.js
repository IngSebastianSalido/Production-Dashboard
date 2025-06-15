const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');

// Cargar las variables de entorno
dotenv.config();

// Ruta al archivo CSV de eficiencia
const efficiencyFilePath = process.env.EFFICIENCY_FILE_PATH 
    ? path.resolve(process.env.EFFICIENCY_FILE_PATH)
    : path.resolve(__dirname, '../data/efficiency.csv');

// Asegurarse de que el directorio existe
const dir = path.dirname(efficiencyFilePath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Verificar si el archivo existe, si no, crearlo con encabezados
if (!fs.existsSync(efficiencyFilePath)) {
    fs.writeFileSync(efficiencyFilePath, 'fecha;dia;meta;real\n');
}

// Endpoint para obtener datos de eficiencia por mes completo
router.get('/efficiency/:fecha', (req, res) => {
    const { fecha } = req.params;

    fs.readFile(efficiencyFilePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('No se pudo leer el archivo de eficiencia.');

        // Parsear fecha como local para evitar desfase UTC
        const parts = fecha.split('-').map(Number);
        if (parts.length !== 3) return res.status(400).send('Formato de fecha inválido. Use YYYY-MM-DD');
        const fechaObj = new Date(parts[0], parts[1] - 1, parts[2]);
        if (isNaN(fechaObj)) return res.status(400).send('Formato de fecha inválido. Use YYYY-MM-DD');

        const year = fechaObj.getFullYear();
        const month = fechaObj.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Parse CSV en registros
        const registros = data
            .split('\n').slice(1)
            .filter(line => line.trim())
            .map(line => {
                const [f, , m, r] = line.split(';');
                return { fecha: f, meta: Number(m)||0, real: Number(r)||0 };
            });

        // Inicializar arrays con ceros
        const metaValues = Array(daysInMonth).fill(0);
        const realValues = Array(daysInMonth).fill(0);

        // Rellenar con valores del CSV
        registros.forEach(({ fecha: f, meta, real }) => {
            // Parsear cada registro como fecha local
            const [yy, mm, dd] = f.split('-').map(Number);
            const dLocal = new Date(yy, mm - 1, dd);
            if (dLocal.getFullYear() === year && dLocal.getMonth() === month) {
                const idx = dLocal.getDate() - 1;
                metaValues[idx] = meta;
                realValues[idx] = real;
            }
        });

        res.json({ metaValues, realValues });
    });
});

// Endpoint para guardar o actualizar datos de eficiencia (sobrescribe mes completo)
router.post('/efficiency', (req, res) => {
  const { fecha, metaValues, realValues } = req.body;
  console.log('Payload POST /efficiency:', req.body);
  if (!fecha || !Array.isArray(metaValues) || !Array.isArray(realValues)) {
    return res.status(400).send('Se requiere fecha, metaValues y realValues como arrays');
  }
  // Parsear año y mes
  const parts = fecha.split('-').map(Number);
  if (parts.length !== 3) return res.status(400).send('Formato de fecha inválido');
  const year = parts[0], month = parts[1] - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Leer CSV existente
  fs.readFile(efficiencyFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer CSV:', err);
      return res.status(500).send('Error al leer archivo de eficiencia');
    }
    const lines = data.split('\n');
    const header = lines[0];
    const existing = lines.slice(1)
      .filter(l => l.trim())
      .filter(line => {
        const date = line.split(';')[0];
        const p = date.split('-').map(Number);
        return !(p[0] === year && p[1] - 1 === month);
      });
    // Construir nuevas líneas para el mes
    const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const newLines = [];
    // Generar nuevas líneas solo para días editados (meta>0 o real>0)
    for (let i = 1; i <= daysInMonth; i++) {
      const meta = Number(metaValues[i-1]) || 0;
      const real = Number(realValues[i-1]) || 0;
      if (meta > 0 || real > 0) {
        const diaDate = new Date(year, month, i);
        const dayName = diasSemana[diaDate.getUTCDay && diaDate.getUTCDay() || diaDate.getDay()];
        const dateStr = `${fecha.slice(0,7)}-${String(i).padStart(2,'0')}`;
        newLines.push(`${dateStr};${dayName};${meta};${real}`);
      }
    }
    // Unir y guardar
    const merged = [header, ...existing, ...newLines].join('\n');
    fs.writeFile(efficiencyFilePath, merged, err => {
      if (err) {
        console.error('Error al escribir CSV:', err);
        return res.status(500).send('No se pudo guardar datos de eficiencia');
      }
      console.log('Mes actualizado:', `${year}-${month+1}`);
      res.send('Datos de eficiencia guardados correctamente');
    });
  });
});

// Endpoint para actualizar un solo día de eficiencia
router.post('/efficiency/day', (req, res) => {
    const { fecha, meta, real } = req.body;
    if (!fecha || meta === undefined || real === undefined) {
        return res.status(400).send('Se requieren fecha, meta y real');
    }
    // Leer archivo CSV
    fs.readFile(efficiencyFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error al leer CSV en /efficiency/day:', err);
            return res.status(500).send('No se pudo leer el archivo de eficiencia');
        }
        const rows = data.split('\n');
        const headers = rows[0];
        let registros = rows.slice(1).filter(r => r.trim() !== '');
        // Filtrar registro existente de esta fecha
        registros = registros.filter(row => row.split(';')[0] !== fecha);
        // Determinar nombre de día en español
        const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        // Usar UTC para evitar desfase de zona horaria
        const [y, m, d] = fecha.split('-').map(Number);
        const utcDate = new Date(Date.UTC(y, m - 1, d));
        const dayName = diasSemana[utcDate.getUTCDay()] || '';  
        // Añadir nuevo registro
        const nuevoRegistro = `${fecha};${dayName};${meta};${real}`;
        registros.push(nuevoRegistro);
        // Guardar CSV actualizado
        const nuevoContenido = [headers, ...registros].join('\n');
        fs.writeFile(efficiencyFilePath, nuevoContenido, (err) => {
            if (err) {
                console.error('Error al escribir CSV en /efficiency/day:', err);
                return res.status(500).send('No se pudo guardar la información de eficiencia');
            }
            console.log(`Registro día ${fecha} guardado: Meta=${meta}, Real=${real}`);
            res.send('Día actualizado correctamente');
        });
    });
});

module.exports = router;
