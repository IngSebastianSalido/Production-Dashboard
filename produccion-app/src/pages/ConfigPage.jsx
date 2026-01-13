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
  const [newDescripcionModoFalla, setNewDescripcionModoFalla] = useState(''); // Nuevo estado para la descripción del modo de falla
  const [newRate, setNewRate] = useState(''); // Nuevo estado para el rate
  const [newRateDos, setNewRateDos] = useState(''); // Nuevo estado para el rateDos
  const [newPN, setNewPN] = useState(''); // Nuevo estado para el PN

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

  const handleAddOption = async (type, name, parent, rate, rateDos, pn, descripcionModoFalla) => {
    if (!name || (type === 'lineas' && (rate === undefined || rate === '' || rateDos === undefined || rateDos === '' || pn === undefined || pn === ''))) return;
    try {
      await axios.post(`${serverApiUrl}/api/opciones`, { type, name, parent, rate, rateDos, pn, descripcionModoFalla });
      setOptions(prevOptions => ({
        ...prevOptions,
        [type]: [...prevOptions[type], { name, parent, rate, rateDos, pn, descripcionModoFalla }],
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
    setNewDescripcionModoFalla(''); // Limpiar input de Descripción del Modo de Falla
    setNewRate(''); // Limpiar input de Rate
    setNewRateDos(''); // Limpiar input de RateDos
    setNewPN(''); // Limpiar input de PN
  };

  const handleSelectLinea = (e) => {
    setSelectedLinea(e.target.value);
    setSelectedEstacion(''); // Reiniciar Estación
    setSelectedModoFalla(''); // Reiniciar Modo de Falla
    setNewEstacion(''); // Limpiar input de Estación
    setNewModoFalla(''); // Limpiar input de Modo de Falla
    setNewDescripcionModoFalla(''); // Limpiar input de Descripción del Modo de Falla
  };

  const handleSelectEstacion = (e) => {
    setSelectedEstacion(e.target.value);
    setSelectedModoFalla(''); // Reiniciar Modo de Falla
    setNewModoFalla(''); // Limpiar input de Modo de Falla
    setNewDescripcionModoFalla(''); // Limpiar input de Descripción del Modo de Falla
  };

  // Obtener líneas únicas
  const uniqueLineas = Array.from(new Set(options.lineas.map(linea => linea.name)));

  return (
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">Configuración de Valores</h1>
        <p className="page-subtitle">Administración de áreas, líneas, estaciones y modos de falla</p>
      </div>

      {/* Áreas */}
      <div className="panel">
        <div className="panel-header">
          <h2>Gestión de Áreas</h2>
        </div>
        <div style={{ padding: '20px' }}>
          <div className="filter-group">
            <label>Seleccionar Área:</label>
            <select value={selectedArea} onChange={handleSelectArea}>
              <option value="">Selecciona un Área</option>
              {options.areas.map((area, index) => (
                <option key={index} value={area.name}>{area.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Nuevo/Modificar Área:</label>
            <input type="text" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Nombre del área" />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button className="btn btn-primary" onClick={() => handleModifyOption('areas', selectedArea, newArea)}>Modificar</button>
            <button className="btn btn-danger" onClick={() => handleRemove('areas', selectedArea)}>Eliminar</button>
            <button className="btn btn-success" onClick={() => handleAddOption('areas', newArea, null)}>Agregar</button>
          </div>
        </div>
      </div>

      {/* Líneas */}
      {selectedArea && (
        <div className="panel">
          <div className="panel-header">
            <h2>Gestión de Líneas</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="filter-group">
              <label>Seleccionar Línea:</label>
              <select value={selectedLinea} onChange={handleSelectLinea}>
                <option value="">Selecciona una Línea</option>
                {uniqueLineas.filter(linea => options.lineas.some(l => l.name === linea && l.parent === selectedArea)).map((linea, index) => (
                  <option key={index} value={linea}>{linea}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Nuevo/Modificar Línea:</label>
              <input type="text" value={newLinea} onChange={(e) => setNewLinea(e.target.value)} placeholder="Nombre de la línea" />
            </div>
            <div className="filter-group">
              <label>Rate:</label>
              <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="Rate" />
            </div>
            <div className="filter-group">
              <label>Rate Dos:</label>
              <input type="number" value={newRateDos} onChange={(e) => setNewRateDos(e.target.value)} placeholder="Rate Dos" />
            </div>
            <div className="filter-group">
              <label>PN:</label>
              <input type="text" value={newPN} onChange={(e) => setNewPN(e.target.value)} placeholder="PN" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button className="btn btn-primary" onClick={() => handleModifyOption('lineas', selectedLinea, newLinea)}>Modificar</button>
              <button className="btn btn-danger" onClick={() => handleRemove('lineas', selectedLinea)}>Eliminar</button>
              <button className="btn btn-success" onClick={() => handleAddOption('lineas', newLinea, selectedArea, newRate, newRateDos, newPN)}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Estaciones */}
      {selectedLinea && (
        <div className="panel">
          <div className="panel-header">
            <h2>Gestión de Estaciones</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="filter-group">
              <label>Seleccionar Estación:</label>
              <select value={selectedEstacion} onChange={handleSelectEstacion}>
                <option value="">Selecciona una Estación</option>
                {options.estaciones.filter(estacion => estacion.parent === selectedLinea).map((estacion, index) => (
                  <option key={index} value={estacion.name}>{estacion.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Nueva/Modificar Estación:</label>
              <input type="text" value={newEstacion} onChange={(e) => setNewEstacion(e.target.value)} placeholder="Nombre de la estación" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button className="btn btn-primary" onClick={() => handleModifyOption('estaciones', selectedEstacion, newEstacion)}>Modificar</button>
              <button className="btn btn-danger" onClick={() => handleRemove('estaciones', selectedEstacion)}>Eliminar</button>
              <button className="btn btn-success" onClick={() => handleAddOption('estaciones', newEstacion, selectedLinea)}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modos de Falla */}
      {selectedEstacion && (
        <div className="panel">
          <div className="panel-header">
            <h2>Gestión de Modos de Falla</h2>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="filter-group">
              <label>Seleccionar Modo de Falla:</label>
              <select value={selectedModoFalla} onChange={(e) => setSelectedModoFalla(e.target.value)}>
                <option value="">Selecciona un Modo de Falla</option>
                {options.modosFalla.filter(modoFalla => modoFalla.parent === selectedEstacion).map((modoFalla, index) => (
                  <option key={index} value={modoFalla.name}>{modoFalla.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Nuevo/Modificar Modo de Falla:</label>
              <input type="text" value={newModoFalla} onChange={(e) => setNewModoFalla(e.target.value)} placeholder="Nombre del modo de falla" />
            </div>
            <div className="filter-group">
              <label>Descripción del Modo de Falla:</label>
              <textarea value={newDescripcionModoFalla} onChange={(e) => setNewDescripcionModoFalla(e.target.value)} placeholder="Descripción detallada" rows="3" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button className="btn btn-primary" onClick={() => handleModifyOption('modosFalla', selectedModoFalla, newModoFalla)}>Modificar</button>
              <button className="btn btn-danger" onClick={() => handleRemove('modosFalla', selectedModoFalla)}>Eliminar</button>
              <button className="btn btn-success" onClick={() => handleAddOption('modosFalla', newModoFalla, selectedEstacion, null, null, null, newDescripcionModoFalla)}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPage;