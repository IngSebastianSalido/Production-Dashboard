import React, { useState, useEffect } from 'react';
import axios from 'axios';

const apiUrl = 'http://192.168.68.165:3000/api/opciones';

const fetchOptions = async () => {
  try {
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching options:', error);
    return { areas: [], lineas: [], estaciones: [] };
  }
};

const addOption = async (type, name, parent) => {
  try {
    await axios.post(apiUrl, { type, name, parent });
  } catch (error) {
    console.error(`Error adding ${type}:`, error);
  }
};

const removeOption = async (type, name) => {
  try {
    await axios.delete(`${apiUrl}/${type}/${name}`);
  } catch (error) {
    console.error(`Error removing ${type}:`, error);
  }
};

const ConfigPage = () => {
  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [] });
  const [newArea, setNewArea] = useState('');
  const [newLinea, setNewLinea] = useState('');
  const [newEstacion, setNewEstacion] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedLinea, setSelectedLinea] = useState('');

  useEffect(() => {
    const loadOptions = async () => {
      const fetchedOptions = await fetchOptions();
      setOptions(fetchedOptions);
    };

    loadOptions();
  }, []);

  const handleAddOption = async (type, name, parent, setName) => {
    await addOption(type, name, parent);
    setOptions((prevOptions) => ({
      ...prevOptions,
      [type]: [...prevOptions[type], { name, parent }],
    }));
    setName('');
  };

  const handleRemoveOption = async (type, name) => {
    await removeOption(type, name);
    setOptions((prevOptions) => ({
      ...prevOptions,
      [type]: prevOptions[type].filter((option) => option.name !== name),
    }));
  };

  return (
    <div style={styles.container}>
      <h1>Configuración de Valores</h1>
      <div style={styles.formGroup}>
        <label style={styles.label}>Agregar Área:</label>
        <div style={styles.horizontalGroup}>
          <input
            type="text"
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            style={styles.input}
          />
          <button onClick={() => handleAddOption('areas', newArea, null, setNewArea)} style={styles.button}>Agregar</button>
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Agregar Línea:</label>
        <div style={styles.horizontalGroup}>
          <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} style={styles.select}>
            <option value="">Seleccionar Área</option>
            {options.areas.map((area, index) => (
              <option key={index} value={area.name}>{area.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={newLinea}
            onChange={(e) => setNewLinea(e.target.value)}
            style={styles.input}
          />
          <button onClick={() => handleAddOption('lineas', newLinea, selectedArea, setNewLinea)} style={styles.button}>Agregar</button>
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Agregar Estación:</label>
        <div style={styles.horizontalGroup}>
          <select value={selectedLinea} onChange={(e) => setSelectedLinea(e.target.value)} style={styles.select}>
            <option value="">Seleccionar Línea</option>
            {options.lineas.filter(linea => linea.parent === selectedArea).map((linea, index) => (
              <option key={index} value={linea.name}>{linea.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={newEstacion}
            onChange={(e) => setNewEstacion(e.target.value)}
            style={styles.input}
          />
          <button onClick={() => handleAddOption('estaciones', newEstacion, selectedLinea, setNewEstacion)} style={styles.button}>Agregar</button>
        </div>
      </div>
      <div style={styles.tableContainer}>
        <h2>Áreas, Líneas y Estaciones</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Área</th>
              <th>Línea</th>
              <th>Estación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {options.areas.map((area, areaIndex) => (
              <React.Fragment key={areaIndex}>
                <tr>
                  <td>{area.name}</td>
                  <td colSpan="2"></td>
                  <td>
                    <button onClick={() => handleRemoveOption('areas', area.name)} style={styles.button}>Eliminar</button>
                  </td>
                </tr>
                {options.lineas.filter(linea => linea.parent === area.name).map((linea, lineaIndex) => (
                  <React.Fragment key={lineaIndex}>
                    <tr>
                      <td></td>
                      <td>{linea.name}</td>
                      <td></td>
                      <td>
                        <button onClick={() => handleRemoveOption('lineas', linea.name)} style={styles.button}>Eliminar</button>
                      </td>
                    </tr>
                    {options.estaciones.filter(estacion => estacion.parent === linea.name).map((estacion, estacionIndex) => (
                      <tr key={estacionIndex}>
                        <td></td>
                        <td></td>
                        <td>{estacion.name}</td>
                        <td>
                          <button onClick={() => handleRemoveOption('estaciones', estacion.name)} style={styles.button}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  label: {
    marginBottom: '5px', // Add margin to separate the label from the input fields
  },
  horizontalGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
  },
  input: {
    width: '200px',
    padding: '10px',
    border: '1px solid #444',
    borderRadius: '5px',
    backgroundColor: '#333',
    color: '#fff',
  },
  select: {
    width: '200px',
    padding: '10px',
    border: '1px solid #444',
    borderRadius: '5px',
    backgroundColor: '#333',
    color: '#fff',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007BFF',
    border: 'none',
    borderRadius: '5px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  tableContainer: {
    marginTop: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    border: '1px solid #ddd',
    padding: '8px',
  },
  td: {
    border: '1px solid #ddd',
    padding: '8px',
  },
};

export default ConfigPage;