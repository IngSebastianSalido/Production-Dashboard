const express = require('express');
const fs = require('fs');

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
    } = req.body;

    console.log("Datos recibidos en el backend (POST /api/paros):", req.body);

    if (!fecha || !area || !linea || !pn || !estacion || !hora_paro || !hora_arranque || !descripcion || !categoria) {
      return res.status(400).send('Todos los campos son obligatorios, excepto el modo de falla y su descripción');
    }

    // Calcular la diferencia de tiempo en minutos
    let diferenciaMinutos;
    
    if (cruza_medianoche) {
      const horaParoDate = new Date(`1970-01-01T${hora_paro}:00Z`);
      const horaArranqueDate = new Date(`1970-01-02T${hora_arranque}:00Z`);
      diferenciaMinutos = Math.round((horaArranqueDate - horaParoDate) / 60000);
    } else {
      const horaParoDate = new Date(`1970-01-01T${hora_paro}:00Z`);
      const horaArranqueDate = new Date(`1970-01-01T${hora_arranque}:00Z`);
      diferenciaMinutos = Math.round((horaArranqueDate - horaParoDate) / 60000);
    }
    
    if (diferenciaMinutos <= 0) {
      return res.status(400).send('El tiempo de paro no puede ser negativo o cero. Verifica las horas ingresadas.');
    }

    fs.readFile(stopsFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error al leer el archivo de paros:', err);
        return res.status(500).send('No se pudo leer el archivo de paros.');
      }

      let registrosToAdd = [];
      if (cruza_medianoche) {
        const [horaParoHour, horaParoMin] = hora_paro.split(':').map(Number);
        const [horaArranqueHour, horaArranqueMin] = hora_arranque.split(':').map(Number);
        const minutosHastaMedianoche = (23 * 60 + 59) - (horaParoHour * 60 + horaParoMin) + 1;
        const minutosDesdeMedianoche = horaArranqueHour * 60 + horaArranqueMin;
        const comentarioMedianoche1 = ' [Paro cruza medianoche - Parte 1]';
        const registro1 = `${fecha};${area};${linea};${pn};${hora_paro};23:59;${minutosHastaMedianoche};${categoria};${estacion};${modoFalla || ''};${descripcionModoFalla || ''};${descripcion}${comentarioMedianoche1}`;
        const fechaArranque = fecha_arranque || (() => {
          const fechaSiguiente = new Date(fecha);
          fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
          return fechaSiguiente.toLocaleDateString('en-CA');
        })();
        const comentarioMedianoche2 = ' [Paro cruza medianoche - Parte 2]';
        const registro2 = `${fechaArranque};${area};${linea};${pn};00:00;${hora_arranque};${minutosDesdeMedianoche};${categoria};${estacion};${modoFalla || ''};${descripcionModoFalla || ''};${descripcion}${comentarioMedianoche2}`;
        registrosToAdd = [registro1, registro2];
      } else {
        const nuevoRegistro = `${fecha};${area};${linea};${pn};${hora_paro};${hora_arranque};${diferenciaMinutos};${categoria};${estacion};${modoFalla || ''};${descripcionModoFalla || ''};${descripcion}`;
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
        .map(line => line.split(';'));

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

  return router;
};
