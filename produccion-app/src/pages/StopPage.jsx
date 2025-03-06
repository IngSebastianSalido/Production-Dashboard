import React, { useState, useEffect } from 'react';

const StopPage = () => {
  const [formData, setFormData] = useState({
    fecha: localStorage.getItem('fecha') || new Date().toISOString().split('T')[0], // Set initial date to today
    area: localStorage.getItem('area') || '',
    linea: localStorage.getItem('linea') || '',
    pn: localStorage.getItem('pn') || '',
    estacion: '',
    modoFalla: '',
    descripcionModoFalla: '', // Agregar estado para la descripción del modo de falla
    categoria: '',
    hora_paro: '',
    hora_arranque: '',
    descripcion: '',
  });

  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [], modosFalla: [] });
  const [categories, setCategories] = useState([]);
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/opciones`);
        const data = await response.json();
        setOptions(data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/categories`);
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchOptions();
    fetchCategories();
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

      if (name !== 'piezas_ok' && name !== 'piezas_nok' && name !== 'estacion' && name !== 'modoFalla' && name !== 'categoria' && name !== 'hora_paro' && name !== 'hora_arranque' && name !== 'descripcion' && name !== 'descripcionModoFalla') {
        localStorage.setItem(name, value);
      }

      return newFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.categoria) {
      alert('La categoría es obligatoria');
      return;
    }
    try {
      const response = await fetch(`${serverApiUrl}/api/paros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Paro registrado correctamente');
        setFormData((prevFormData) => ({
          ...prevFormData,
          estacion: '',
          modoFalla: '',
          descripcionModoFalla: '', // Reiniciar descripción del modo de falla
          categoria: '',
          hora_paro: '',
          hora_arranque: '',
          descripcion: '',
        }));
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

  // Obtener líneas únicas
  const uniqueLineas = Array.from(new Set(options.lineas.map(linea => linea.name)));

  // Obtener modos de falla únicos
  const uniqueModosFalla = Array.from(new Set(options.modosFalla.map(modoFalla => modoFalla.name)));

  // Filtrar descripciones de modos de falla según el modo de falla y la estación seleccionados
  const filteredDescripcionesModoFalla = options.modosFalla.filter(modoFalla => modoFalla.name === formData.modoFalla && modoFalla.parent === formData.estacion);

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
            {uniqueLineas.filter(linea => options.lineas.some(l => l.name === linea && l.parent === formData.area)).map((linea, index) => (
              <option key={index} value={linea}>{linea}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>PN:</label>
          <select name="pn" value={formData.pn} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar PN</option>
            {options.lineas.filter(linea => linea.name === formData.linea).map((linea, index) => (
              <option key={index} value={linea.pn}>{linea.pn}</option>
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
          <label>Modo de Falla (opcional):</label>
          <select name="modoFalla" value={formData.modoFalla} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Modo de Falla</option>
            {uniqueModosFalla.filter(modoFalla => options.modosFalla.some(m => m.name === modoFalla && m.parent === formData.estacion)).map((modoFalla, index) => (
              <option key={index} value={modoFalla}>{modoFalla}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Descripción del Modo de Falla (opcional):</label>
          <select name="descripcionModoFalla" value={formData.descripcionModoFalla} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Descripción</option>
            {filteredDescripcionesModoFalla.map((modoFalla, index) => (
              <option key={index} value={modoFalla.descripcionModoFalla}>{modoFalla.descripcionModoFalla}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label>Categoría:</label>
          <select name="categoria" value={formData.categoria} onChange={handleChange} style={styles.select}>
            <option value="">Seleccionar Categoría</option>
            {categories.map((categoria, index) => (
              <option key={index} value={categoria}>{categoria}</option>
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
  title: {
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxWidth: '400px', // Set a maximum width for the form
    margin: 'auto auto', // Center the form horizontally
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
  },
  input: {
    padding: '5px',
    fontSize: '16px',
    width: '100%', // Make the input take the full width of the form group
    maxWidth: '300px', // Set a maximum width for the input
    alignSelf: 'center',
  },
  select: {
    padding: '10px',
    fontSize: '16px',
    width: '100%', // Make the select take the full width of the form group
    maxWidth: '300px', // Set a maximum width for the select
    alignSelf: 'center',
  },
  textarea: {
    padding: '10px',
    fontSize: '16px',
    width: '100%', // Make the textarea take the full width of the form group
    maxWidth: '300px', // Set a maximum width for the textarea
    height: '100px',
    alignSelf: 'center',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    alignSelf: 'center', // Center the button horizontally
  },
};

export default StopPage;