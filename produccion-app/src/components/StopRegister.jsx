import React, { useState, useEffect } from 'react';

const StopRegister = ({ serverApiUrl, options, categories, onRegister }) => {
  const [formData, setFormData] = useState({
    fecha: '',
    area: localStorage.getItem('area') || '',
    linea: localStorage.getItem('linea') || '',
    pn: localStorage.getItem('pn') || '',
    estacion: '',
    modoFalla: '',
    descripcionModoFalla: '',
    categoria: '',
    hora_paro: '',
    hora_arranque: '', // Restaurar hora de arranque
    descripcion: '',
  });

  useEffect(() => {
    const now = new Date();
    setFormData((prevFormData) => ({
      ...prevFormData,
      fecha: now.toLocaleDateString('en-CA'),
      hora_paro: now.toTimeString().slice(0, 5),
      hora_arranque: '', // Inicializar hora de arranque como vacío
    }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData, [name]: value };

      if (name === 'area') {
        newFormData.linea = '';
        newFormData.pn = '';
        localStorage.removeItem('linea');
        localStorage.removeItem('pn');
      } else if (name === 'linea') {
        newFormData.pn = '';
        localStorage.removeItem('pn');
      }

      if (name !== 'estacion' && name !== 'modoFalla' && name !== 'categoria' && name !== 'hora_paro' && name !== 'hora_arranque' && name !== 'descripcion' && name !== 'descripcionModoFalla') {
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
          descripcionModoFalla: '',
          categoria: '',
          hora_paro: '',
          hora_arranque: '',
          descripcion: '',
        }));
        onRegister();
      } else {
        const errorData = await response.text();
        alert(`Error al registrar el paro: ${errorData}`);
      }
    } catch (error) {
      console.error('Error al enviar el paro:', error);
      alert('Error al enviar el paro.');
    }
  };

  const uniqueLineas = Array.from(new Set(options.lineas.map(linea => linea.name)));
  const uniqueModosFalla = Array.from(new Set(options.modosFalla.map(modoFalla => modoFalla.name)));
  const filteredDescripcionesModoFalla = options.modosFalla.filter(modoFalla => modoFalla.name === formData.modoFalla && modoFalla.parent === formData.estacion);

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.row}>
        {/* Columna izquierda */}
        <div style={styles.column}>
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
            <label>Hora de Paro:</label>
            <input type="time" name="hora_paro" value={formData.hora_paro} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label>Hora de Arranque:</label>
            <input type="time" name="hora_arranque" value={formData.hora_arranque} onChange={handleChange} style={styles.input} />
          </div>
        </div>

        {/* Columna derecha */}
        <div style={styles.column}>
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
            <label>Modo de Falla:</label>
            <select name="modoFalla" value={formData.modoFalla} onChange={handleChange} style={styles.select}>
              <option value="">Seleccionar Modo de Falla</option>
              {uniqueModosFalla.filter(modoFalla => options.modosFalla.some(m => m.name === modoFalla && m.parent === formData.estacion)).map((modoFalla, index) => (
                <option key={index} value={modoFalla}>{modoFalla}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>Descripción del Modo de Falla:</label>
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
            <label>Descripción:</label>
            <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} style={styles.textarea} />
          </div>
        </div>
      </div>
      <button type="submit" style={styles.button}>Registrar Paro</button>
    </form>
  );
};

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxWidth: '800px',
    margin: 'auto',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px',
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  input: {
    padding: '10px',
    fontSize: '16px',
    width: '100%',
    maxWidth: '300px',
  },
  select: {
    padding: '10px',
    fontSize: '16px',
    width: '100%',
    maxWidth: '300px',
    borderRadius: '8px', // Redondear las esquinas
  },
  textarea: {
    padding: '10px',
    fontSize: '16px',
    width: '100%',
    maxWidth: '300px',
    height: '100px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    alignSelf: 'center',
  },

};

export default StopRegister;