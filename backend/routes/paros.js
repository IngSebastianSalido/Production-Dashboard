const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = (stopsFilePath) => {
  const router = express.Router();

  // Endpoint para registrar un paro de línea
  router.post('/paros', (req, res) => {
    const {
      fecha,
      area,
      linea,
      pn,
      estacion,
      modoFalla = '',
      descripcionModoFalla = '',
      hora_paro,
      hora_arranque,
      descripcion,
      categoria,
      cruza_medianoche = false,
      fecha_arranque,
      ajuste_proceso = false,
    } = req.body;

    console.log("Datos recibidos en el backend (POST /api/paros):", req.body);

    if (!fecha || !area || !linea || !pn || !estacion || !hora_paro || !hora_arranque || !descripcion || !categoria) {
      return res.status(400).send('Todos los campos son obligatorios, excepto el modo de falla y su descripción');
    }

    // Función para sanitizar campos de texto (eliminar saltos de línea y punto y coma)
    const sanitizarTexto = (texto) => {
      if (texto === undefined || texto === null) return '';
      return String(texto)
        .replace(/[\r\n]+/g, ' ')  // Reemplazar saltos de línea por espacio
        .replace(/;/g, ',')         // Reemplazar punto y coma por coma
        .trim();                     // Eliminar espacios al inicio y final
    };

    const asBool = (val, defaultValue = false) => {
      if (val === undefined || val === null) return defaultValue;
      if (typeof val === 'boolean') return val;
      const normalized = String(val).toLowerCase().trim();
      return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí';
    };

    // Sanitizar todos los campos de entrada
    const fechaSan = sanitizarTexto(fecha);
    const areaSan = sanitizarTexto(area);
    const lineaSan = sanitizarTexto(linea);
    const pnSan = sanitizarTexto(pn);
    const estacionSan = sanitizarTexto(estacion);
    const categoriaSan = sanitizarTexto(categoria);
    const horaParoSan = sanitizarTexto(hora_paro);
    const horaArranqueSan = sanitizarTexto(hora_arranque);
    const fechaArranqueSan = sanitizarTexto(fecha_arranque);
    const cruzaMedianocheFlag = asBool(cruza_medianoche, false);
    const ajusteProcesoFlag = asBool(ajuste_proceso, false);

    // Sanitizar campos de texto que pueden contener caracteres problemáticos
    const modoFallaSanitizado = sanitizarTexto(modoFalla);
    const descripcionModoFallaSanitizada = sanitizarTexto(descripcionModoFalla);
    const descripcionSanitizada = sanitizarTexto(descripcion);

    // Calcular la diferencia de tiempo en minutos
    let diferenciaMinutos;
    
    if (cruzaMedianocheFlag) {
      const horaParoDate = new Date(`1970-01-01T${horaParoSan}:00Z`);
      const horaArranqueDate = new Date(`1970-01-02T${horaArranqueSan}:00Z`);
      diferenciaMinutos = Math.round((horaArranqueDate - horaParoDate) / 60000);
    } else {
      const horaParoDate = new Date(`1970-01-01T${horaParoSan}:00Z`);
      const horaArranqueDate = new Date(`1970-01-01T${horaArranqueSan}:00Z`);
      diferenciaMinutos = Math.round((horaArranqueDate - horaParoDate) / 60000);
    }
    
    if (diferenciaMinutos <= 0) {
      return res.status(400).send('El tiempo de paro no puede ser negativo o cero. Verifica las horas ingresadas.');
    }

    // Calcular paro_programado: "No" si es "Equipment fault" o "Fallo"; "Si" en otros casos o si descripcionModoFalla contiene "scheduled stop" o "paro programado"
    const esDescripcionProgramada = (descripcionModoFallaSanitizada || '').toLowerCase().includes('scheduled stop')
      || (descripcionModoFallaSanitizada || '').toLowerCase().includes('paro programado');
    const esCategoriaFallo = categoriaSan === 'Equipment fault' || categoriaSan === 'Fallo';
    const paroProgramado = esCategoriaFallo ? 'No' : (esDescripcionProgramada ? 'Si' : 'Si');

    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error al leer el archivo de paros:', err);
        return res.status(500).send('No se pudo leer el archivo de paros.');
      }

      let registrosToAdd = [];
      if (cruzaMedianocheFlag) {
        const [horaParoHour, horaParoMin] = horaParoSan.split(':').map(Number);
        const [horaArranqueHour, horaArranqueMin] = horaArranqueSan.split(':').map(Number);
        const minutosHastaMedianoche = (23 * 60 + 59) - (horaParoHour * 60 + horaParoMin) + 1;
        const minutosDesdeMedianoche = horaArranqueHour * 60 + horaArranqueMin;
        const ajusteProceso = ajusteProcesoFlag ? 'Si' : 'No';
        const comentarioMedianoche1 = ' [Paro cruza medianoche - Parte 1]';
        const registro1 = `${fechaSan};${areaSan};${lineaSan};${pnSan};${horaParoSan};23:59;${minutosHastaMedianoche};${categoriaSan};${estacionSan};${modoFallaSanitizado};${descripcionModoFallaSanitizada};${descripcionSanitizada}${comentarioMedianoche1};${paroProgramado};${ajusteProceso}`;
        const fechaArranque = fechaArranqueSan || (() => {
          const fechaSiguiente = new Date(fechaSan);
          fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
          return fechaSiguiente.toLocaleDateString('en-CA');
        })();
        const comentarioMedianoche2 = ' [Paro cruza medianoche - Parte 2]';
        const registro2 = `${fechaArranque};${areaSan};${lineaSan};${pnSan};00:00;${horaArranqueSan};${minutosDesdeMedianoche};${categoriaSan};${estacionSan};${modoFallaSanitizado};${descripcionModoFallaSanitizada};${descripcionSanitizada}${comentarioMedianoche2};${paroProgramado};${ajusteProceso}`;
        registrosToAdd = [registro1, registro2];
      } else {
        const ajusteProceso = ajusteProcesoFlag ? 'Si' : 'No';
        const nuevoRegistro = `${fechaSan};${areaSan};${lineaSan};${pnSan};${horaParoSan};${horaArranqueSan};${diferenciaMinutos};${categoriaSan};${estacionSan};${modoFallaSanitizado};${descripcionModoFallaSanitizada};${descripcionSanitizada};${paroProgramado};${ajusteProceso}`;
        registrosToAdd = [nuevoRegistro];
      }

      const contenidoActualizado = data.trim() + '\n' + registrosToAdd.join('\n');

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
  router.get('/paros', (req, res) => {
    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error al leer el archivo de paros:', err);
        return res.status(500).send('No se pudo leer el archivo de paros.');
      }

      const paros = data
        .split('\n')
        .slice(1)
        .filter(line => line.trim() !== '')
        .map(line => {
          const cols = line.split(';');
          // Si el registro no tiene paro_programado (columna 12), calcularlo
          if (cols.length < 13 || cols[12] === undefined || cols[12] === '') {
            const categoria = cols[7]; // índice 7 es categoria
            const descripcionModoFalla = cols[10] || ''; // índice 10 es descripcion_modo_falla
            const esDescripcionProgramada = descripcionModoFalla.toLowerCase().includes('scheduled stop') || descripcionModoFalla.toLowerCase().includes('paro programado');
            const esCategoriaFallo = categoria === 'Equipment fault' || categoria === 'Fallo';
            const paroProgramado = esCategoriaFallo ? 'No' : (esDescripcionProgramada ? 'Si' : 'Si');
            cols[12] = paroProgramado;
          }
          // Si el registro no tiene ajuste_proceso (columna 13), agregar "No"
          if (cols.length < 14 || cols[13] === undefined || cols[13] === '') {
            cols[13] = 'No';
          }
          return cols;
        });

      res.json(paros);
    });
  });

  // Endpoint para eliminar un paro
  router.delete('/paros', (req, res) => {
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

  // Endpoint para crear un respaldo del archivo de paros
  // Crea una copia en el mismo directorio con sufijo de fecha y hora
  // Ejemplo: paros_2025-05-08_14-30-00.csv
  router.post('/paros/backup', (req, res) => {
    try {
      if (!fs.existsSync(stopsFilePath)) {
        return res.status(404).json({ error: 'Archivo de paros no encontrado' });
      }
      const requestedDir = (req.body && req.body.backupDir) || (req.query && req.query.backupDir);
      const envDir = process.env.STOPS_BACKUP_DIR;
      const targetDir = requestedDir || envDir || path.dirname(stopsFilePath);

      // Validar o crear el directorio destino
      try {
        if (fs.existsSync(targetDir)) {
          const st = fs.statSync(targetDir);
          if (!st.isDirectory()) {
            return res.status(400).json({ error: 'La ruta de destino no es un directorio' });
          }
        } else {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      } catch (prepErr) {
        console.error('No se pudo preparar el directorio de respaldo:', prepErr);
        return res.status(500).json({ error: 'No se pudo preparar el directorio de respaldo' });
      }
      const ext = path.extname(stopsFilePath);
      const base = path.basename(stopsFilePath, ext);

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timestamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
      ].join('-') + '_' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-');

      const backupName = `${base}_${timestamp}${ext}`;
      const backupPath = path.join(targetDir, backupName);

      fs.copyFile(stopsFilePath, backupPath, (err) => {
        if (err) {
          console.error('Error al crear el respaldo de paros:', err);
          return res.status(500).json({ error: 'No se pudo crear el respaldo' });
        }
        return res.json({
          message: 'Respaldo creado correctamente',
          backupFile: backupName,
          backupPath
        });
      });
    } catch (e) {
      console.error('Excepción al respaldar paros:', e);
      return res.status(500).json({ error: 'Error inesperado al crear respaldo' });
    }
  });

  return router;
};
