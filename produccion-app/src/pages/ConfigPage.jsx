import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ConfigPage.css';

const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

const fetchOptions = async () => {
  try {
    const response = await axios.get(`${serverApiUrl}/api/opciones`);
    return response.data;
  } catch (error) {
    console.error('Error fetching options:', error);
    return { areas: [], lineas: [], estaciones: [], modosFalla: [] };
  }
};

const ConfigPage = () => {
  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [], modosFalla: [] });
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedLinea, setSelectedLinea] = useState('');
  const [selectedEstacion, setSelectedEstacion] = useState('');
  const [selectedModoFalla, setSelectedModoFalla] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newLinea, setNewLinea] = useState('');
  const [newEstacion, setNewEstacion] = useState('');
  const [newModoFalla, setNewModoFalla] = useState('');
  const [newRate, setNewRate] = useState(''); // Nuevo estado para el rate

  useEffect(() => {
    const loadOptions = async () => {
      const fetchedOptions = await fetchOptions();
      setOptions(fetchedOptions);
    };
    loadOptions();
  }, []);

  const handleModifyOption = async (type, oldName, newName) => {
    if (!oldName || !newName) return;
    try {
      await axios.put(`${serverApiUrl}/api/opciones/${type}/${oldName}`, { name: newName });
      setOptions(prevOptions => {
        const updatedOptions = { ...prevOptions };
        updatedOptions[type] = prevOptions[type].map(option => option.name === oldName ? { ...option, name: newName } : option);
        if (type === 'areas') {
          updatedOptions.lineas = prevOptions.lineas.map(linea => linea.parent === oldName ? { ...linea, parent: newName } : linea);
          updatedOptions.estaciones = prevOptions.estaciones.map(estacion => estacion.parent === oldName ? { ...estacion, parent: newName } : estacion);
          updatedOptions.modosFalla = prevOptions.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: newName } : modoFalla);
        } else if (type === 'lineas') {
          updatedOptions.estaciones = prevOptions.estaciones.map(estacion => estacion.parent === oldName ? { ...estacion, parent: newName } : estacion);
          updatedOptions.modosFalla = prevOptions.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: newName } : modoFalla);
        } else if (type === 'estaciones') {
          updatedOptions.modosFalla = prevOptions.modosFalla.map(modoFalla => modoFalla.parent === oldName ? { ...modoFalla, parent: newName } : modoFalla);
        }
        return updatedOptions;
      });
    } catch (error) {
      console.error(`Error modifying ${type}:`, error);
    }
  };

  const handleRemove = async (type, name) => {
    if (!name) return;
    try {
      await axios.delete(`${serverApiUrl}/api/opciones/${type}/${name}`);
      setOptions(prevOptions => ({
        ...prevOptions,
        [type]: prevOptions[type].filter(option => option.name !== name),
      }));
    } catch (error) {
      console.error(`Error removing ${type}:`, error);
    }
  };

  const handleAddOption = async (type, name, parent, rate) => {
    if (!name || (type === 'lineas' && (rate === undefined || rate === ''))) return;
    try {
      await axios.post(`${serverApiUrl}/api/opciones`, { type, name, parent, rate });
      setOptions(prevOptions => ({
        ...prevOptions,
        [type]: [...prevOptions[type], { name, parent, rate }],
      }));
    } catch (error) {
      console.error(`Error adding ${type}:`, error);
    }
  };

  const handleSelectArea = (e) => {
    setSelectedArea(e.target.value);
    setSelectedLinea(''); // Reiniciar Línea
    setSelectedEstacion(''); // Reiniciar Estación
    setSelectedModoFalla(''); // Reiniciar Modo de Falla
    setNewLinea(''); // Limpiar input de Línea
    setNewEstacion(''); // Limpiar input de Estación
    setNewModoFalla(''); // Limpiar input de Modo de Falla
    setNewRate(''); // Limpiar input de Rate
  };

  const handleSelectLinea = (e) => {
    setSelectedLinea(e.target.value);
    setSelectedEstacion(''); // Reiniciar Estación
    setSelectedModoFalla(''); // Reiniciar Modo de Falla
    setNewEstacion(''); // Limpiar input de Estación
    setNewModoFalla(''); // Limpiar input de Modo de Falla
  };

  const handleSelectEstacion = (e) => {
    setSelectedEstacion(e.target.value);
    setSelectedModoFalla(''); // Reiniciar Modo de Falla
    setNewModoFalla(''); // Limpiar input de Modo de Falla
  };

  return (
    <div className="config-container">
      <h1 className="title">Configuración de Valores</h1>

      {/* Áreas */}
      <div className="section">
        <h2>Seleccionar Área</h2>
        <select value={selectedArea} onChange={handleSelectArea} className="select">
          <option value="">Selecciona un Área</option>
          {options.areas.map((area, index) => (
            <option key={index} value={area.name}>{area.name}</option>
          ))}
        </select>
        <input type="text" value={newArea} onChange={(e) => setNewArea(e.target.value)} className="input" placeholder="Modificar/Agregar Área" />
        <div className="button-group">
          <button className="button" onClick={() => handleModifyOption('areas', selectedArea, newArea)}>Modificar</button>
          <button className="button delete" onClick={() => handleRemove('areas', selectedArea)}>Eliminar</button>
          <button className="button add" onClick={() => handleAddOption('areas', newArea, null)}>Agregar</button>
        </div>
      </div>

      {/* Líneas */}
      {selectedArea && (
        <div className="section">
          <h2>Seleccionar Línea</h2>
          <select value={selectedLinea} onChange={handleSelectLinea} className="select">
            <option value="">Selecciona una Línea</option>
            {options.lineas.filter(linea => linea.parent === selectedArea).map((linea, index) => (
              <option key={index} value={linea.name}>{linea.name}</option>
            ))}
          </select>
          <input type="text" value={newLinea} onChange={(e) => setNewLinea(e.target.value)} className="input" placeholder="Modificar/Agregar Línea" />
          <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} className="input" placeholder="Rate" />
          <div className="button-group">
            <button className="button" onClick={() => handleModifyOption('lineas', selectedLinea, newLinea)}>Modificar</button>
            <button className="button delete" onClick={() => handleRemove('lineas', selectedLinea)}>Eliminar</button>
            <button className="button add" onClick={() => handleAddOption('lineas', newLinea, selectedArea, newRate)}>Agregar</button>
          </div>
        </div>
      )}

      {/* Estaciones */}
      {selectedLinea && (
        <div className="section">
          <h2>Seleccionar Estación</h2>
          <select value={selectedEstacion} onChange={handleSelectEstacion} className="select">
            <option value="">Selecciona una Estación</option>
            {options.estaciones.filter(estacion => estacion.parent === selectedLinea).map((estacion, index) => (
              <option key={index} value={estacion.name}>{estacion.name}</option>
            ))}
          </select>
          <input type="text" value={newEstacion} onChange={(e) => setNewEstacion(e.target.value)} className="input" placeholder="Modificar/Agregar Estación" />
          <div className="button-group">
            <button className="button" onClick={() => handleModifyOption('estaciones', selectedEstacion, newEstacion)}>Modificar</button>
            <button className="button delete" onClick={() => handleRemove('estaciones', selectedEstacion)}>Eliminar</button>
            <button className="button add" onClick={() => handleAddOption('estaciones', newEstacion, selectedLinea)}>Agregar</button>
          </div>
        </div>
      )}

      {/* Modos de Falla */}
      {selectedEstacion && (
        <div className="section">
          <h2>Seleccionar Modo de Falla</h2>
          <select value={selectedModoFalla} onChange={(e) => setSelectedModoFalla(e.target.value)} className="select">
            <option value="">Selecciona un Modo de Falla</option>
            {options.modosFalla.filter(modoFalla => modoFalla.parent === selectedEstacion).map((modoFalla, index) => (
              <option key={index} value={modoFalla.name}>{modoFalla.name}</option>
            ))}
          </select>
          <input type="text" value={newModoFalla} onChange={(e) => setNewModoFalla(e.target.value)} className="input" placeholder="Modificar/Agregar Modo de Falla" />
          <div className="button-group">
            <button className="button" onClick={() => handleModifyOption('modosFalla', selectedModoFalla, newModoFalla)}>Modificar</button>
            <button className="button delete" onClick={() => handleRemove('modosFalla', selectedModoFalla)}>Eliminar</button>
            <button className="button add" onClick={() => handleAddOption('modosFalla', newModoFalla, selectedEstacion)}>Agregar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPage;