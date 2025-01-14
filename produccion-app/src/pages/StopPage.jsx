import React, { useState, useEffect } from 'react';

const StopPage = () => {
  const [formData, setFormData] = useState({
    fecha: localStorage.getItem('fecha') || new Date().toISOString().split('T')[0], // Set initial date to today
    area: '',
    linea: '',
    estacion: '',
    hora_paro: '',
    hora_arranque: '',
    descripcion: '',
  });

  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [] });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('http://192.168.68.165:3000/api/opciones');
        const data = await response.json();
        setOptions(data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    fetchOptions();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://192.168.68.165:3000/api/paros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Paro registrado correctamente');
        setFormData({
          fecha: localStorage.getItem('fecha') || new Date().toISOString().split('T')[0], // Reset to today's date
          area: '',
          linea: '',
          estacion: '',
          hora_paro: '',
          hora_arranque: '',
          descripcion: '',
        });
      } else {
        const errorData = await response.text();
        alert(`Error al registrar el paro: ${errorData}`);
      }
    } catch (error) {
      console.error('Error al enviar el paro:', error);
      alert('Error al enviar el paro.');
    }
  };

  // Save the date to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('fecha', formData.fecha);
  }, [formData.fecha]);

  return (
    <div className="main-container">
      <h1 style={styles.title}>Registrar Paro de Línea</h1>
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
            {options.lineas.filter(linea => linea.parent === formData.area).map((linea, index) => (
              <option key={index} value={linea.name}>{linea.name}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Estación:</label>
          <select name="estacion" value={formData.estacion} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Estación</option>
            {options.estaciones.filter(estacion => estacion.parent === formData.linea).map((estacion, index) => (
              <option key={index} value={estacion.name}>{estacion.name}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Hora de Paro:</label>
          <input type="time" name="hora_paro" value={formData.hora_paro} onChange={handleChange} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label>Hora de Arranque:</label>
          <input type="time" name="hora_arranque" value={formData.hora_arranque} onChange={handleChange} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label>Descripción:</label>
          <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} style={styles.textarea} />
        </div>
        <button type="submit" style={styles.button}>Registrar Paro</button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    paddingTop: '60px', // Add padding to the top to create space for the menu
    textAlign: 'center',
  },
  title: {
    marginBottom: '20px',
    whiteSpace: 'nowrap', // Prevent title from being cut off
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  form: {
    maxWidth: '350px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  select: {
    width: '325px',
    padding: '10px',
    marginTop: '5px',
  },
  input: {
    width: '325px',
    padding: '10px',
    marginTop: '5px',
  },
  textarea: {
    width: '325px',
    padding: '10px',
    marginTop: '5px',
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
  },
};

export default StopPage;