import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReportForm = () => {
  const [formData, setFormData] = useState({
    fecha: localStorage.getItem('fecha') || '',
    area: localStorage.getItem('area') || '',
    linea: localStorage.getItem('linea') || '',
    pn: localStorage.getItem('pn') || '',
    hora: localStorage.getItem('hora') || '',
    piezas_ok: 0,
    piezas_nok: 0,
  });

  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [], modosFalla: [] });
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await axios.get(`${serverApiUrl}/api/opciones`);
        setOptions(response.data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    fetchOptions();
  }, [serverApiUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData, [name]: value };
      // Save the updated form data to localStorage
      if (name === 'area') {
        newFormData.linea = '';
        newFormData.pn = '';
        localStorage.removeItem('linea');
        localStorage.removeItem('pn');
      } else if (name === 'linea') {
        newFormData.pn = '';
        localStorage.removeItem('pn');
      }

      if (name !== 'piezas_ok' && name !== 'piezas_nok') {
        localStorage.setItem(name, value);
      }
      return newFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${serverApiUrl}/api/reportes`, formData);
      if (response.status === 200) {
        alert('Reporte guardado correctamente');
        setFormData((prevFormData) => ({
          ...prevFormData,
          piezas_ok: 0,
          piezas_nok: 0,
        }));
      } else {
        alert('Error al guardar el reporte');
      }
    } catch (error) {
      console.error('Error al enviar el reporte:', error);
      alert('Error al enviar el reporte');
    }
  };

  // Obtener líneas únicas
  const uniqueLineas = Array.from(new Set(options.lineas.map(linea => linea.name)));

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label>Fecha:</label>
          <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label>Área:</label>
          <select name="area" value={formData.area} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Área</option>
            {options.areas.map((area, index) => (
              <option key={index} value={area.name}>{area.name}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Línea:</label>
          <select name="linea" value={formData.linea} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Línea</option>
            {uniqueLineas.filter(linea => options.lineas.some(l => l.name === linea && l.parent.toLowerCase() === formData.area.toLowerCase())).map((linea, index) => (
              <option key={index} value={linea}>{linea}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>PN:</label>
          <select name="pn" value={formData.pn} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar PN</option>
            {options.lineas.filter(linea => linea.name.toLowerCase() === formData.linea.toLowerCase()).map((linea, index) => (
              <option key={index} value={linea.pn}>{linea.pn}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Hora:</label>
          <select name="hora" value={formData.hora} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Hora</option>
            {[...Array(24).keys()].map(hour => (
              <option key={hour} value={hour < 10 ? `0${hour}:00` : `${hour}:00`}>
                {hour < 10 ? `0${hour}:00` : `${hour}:00`}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Piezas OK:</label>
          <input type="number" name="piezas_ok" value={formData.piezas_ok} onChange={handleChange} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label>Piezas NOK:</label>
          <input type="number" name="piezas_nok" value={formData.piezas_nok} onChange={handleChange} style={styles.input} />
        </div>
        <button type="submit" style={styles.button}>Registrar Reporte</button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
  },
  form: {
    maxWidth: '325px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  select: {
    width: '100%',
    padding: '10px',
    marginTop: '0px',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginTop: '0px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007BFF',
    border: 'none',
    borderRadius: '5px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold',
    alignSelf: 'center',
    marginTop: '10px',
  },
};

export default ReportForm;