const express = require('express');
const fs = require('fs');

module.exports = (optionsFilePath) => {
  const router = express.Router();

  let options = { areas: [], lineas: [], estaciones: [], modosFalla: [] };

  const loadOptions = () => {
    if (fs.existsSync(optionsFilePath)) {
      const data = fs.readFileSync(optionsFilePath, 'utf8');
      options = JSON.parse(data);
    }
  };

  const saveOptions = () => {
    fs.writeFileSync(optionsFilePath, JSON.stringify(options, null, 2), 'utf8');
  };

  loadOptions();

  router.get('/opciones', (req, res) => {
    res.json(options);
  });

  router.post('/opciones', (req, res) => {
    const { type, name, parent, rate, rateDos, pn, descripcionModoFalla } = req.body;

    if (!type || !name) return res.status(400).json({ error: 'Type and name are required' });

    if (type === 'areas') {
      options.areas.push({ name });
    } else if (type === 'lineas') {
      if (!parent || rate === undefined || rate === '' || rateDos === undefined || rateDos === '' || pn === undefined || pn === '') {
        return res.status(400).json({ error: 'Parent, rate, rateDos, and PN are required for lineas' });
      }
      options.lineas.push({ name, parent, rate, rateDos, pn });
    } else if (type === 'estaciones') {
      if (!parent) return res.status(400).json({ error: 'Parent is required for estaciones' });
      options.estaciones.push({ name, parent });
    } else if (type === 'modosFalla') {
      if (!parent) return res.status(400).json({ error: 'Parent is required for modosFalla' });
      options.modosFalla.push({ name, parent, descripcionModoFalla });
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    saveOptions();
    res.status(201).json({ message: `${type.slice(0, -1)} added successfully` });
  });

  router.delete('/opciones/:type/:name', (req, res) => {
    const { type, name } = req.params;
    if (!type || !name) return res.status(400).json({ error: 'Type and name are required' });

    if (type === 'areas') {
      options.areas = options.areas.filter(area => area.name !== name);
      options.lineas = options.lineas.filter(linea => linea.parent !== name);
      options.estaciones = options.estaciones.filter(estacion => estacion.parent !== name);
    } else if (type === 'lineas') {
      options.lineas = options.lineas.filter(linea => linea.name !== name);
      options.estaciones = options.estaciones.filter(estacion => estacion.parent !== name);
    } else if (type === 'estaciones') {
      options.estaciones = options.estaciones.filter(estacion => estacion.name !== name);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    saveOptions();
    res.status(200).json({ message: `${type.slice(0, -1)} removed successfully` });
  });

  router.put('/opciones/:type/:oldName', (req, res) => {
    const { type, oldName } = req.params;
    const { name } = req.body;
    if (!type || !oldName || !name) return res.status(400).json({ error: 'Type, old name, and new name are required' });

    if (type === 'areas') {
      options.areas = options.areas.map(area => area.name === oldName ? { ...area, name } : area);
      options.lineas = options.lineas.map(linea => linea.parent === oldName ? { ...linea, parent: name } : linea);
      options.estaciones = options.estaciones.map(estacion => estacion.parent === oldName ? { ...estacion, parent: name } : estacion);
      options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: name } : modoFalla);
    } else if (type === 'lineas') {
      options.lineas = options.lineas.map(linea => linea.name === oldName ? { ...linea, name } : linea);
      options.estaciones = options.estaciones.map(estacion => estacion.parent === oldName ? { ...estacion, parent: name } : estacion);
      options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: name } : modoFalla);
    } else if (type === 'estaciones') {
      options.estaciones = options.estaciones.map(estacion => estacion.name === oldName ? { ...estacion, name } : estacion);
      options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: name } : modoFalla);
    } else if (type === 'modosFalla') {
      options.modosFalla = options.modosFalla.map(modoFalla => modoFalla.name === oldName ? { ...modoFalla, name } : modoFalla);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    saveOptions();
    res.status(200).json({ message: `${type.slice(0, -1)} modified successfully` });
  });

  return router;
};
