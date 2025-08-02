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
    cruza_medianoche: false, // Nuevo campo para manejar paros que cruzan medianoche
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

  // Función para validar tiempos
  const validateTimes = (horaParo, horaArranque, cruzaMedianoche) => {
    if (!horaParo || !horaArranque) return true; // Si alguna hora está vacía, no validar aún
    
    const [horaParoHour, horaParoMin] = horaParo.split(':').map(Number);
    const [horaArranqueHour, horaArranqueMin] = horaArranque.split(':').map(Number);
    
    const paroMinutes = horaParoHour * 60 + horaParoMin;
    const arranqueMinutes = horaArranqueHour * 60 + horaArranqueMin;
    
    if (cruzaMedianoche) {
      // Si cruza medianoche, la hora de arranque debe ser menor que la de paro
      // (porque el arranque es al día siguiente)
      return arranqueMinutes < paroMinutes;
    } else {
      // Mismo día: arranque debe ser mayor que paro
      return arranqueMinutes > paroMinutes;
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData, [name]: newValue };

      if (name === 'area') {
        newFormData.linea = '';
        newFormData.pn = '';
        localStorage.removeItem('linea');
        localStorage.removeItem('pn');
      } else if (name === 'linea') {
        newFormData.pn = '';
        localStorage.removeItem('pn');
      }

      // Validar tiempos cuando se cambia hora_paro, hora_arranque o cruza_medianoche
      if (name === 'hora_paro' || name === 'hora_arranque' || name === 'cruza_medianoche') {
        const horaParo = name === 'hora_paro' ? newValue : newFormData.hora_paro;
        const horaArranque = name === 'hora_arranque' ? newValue : newFormData.hora_arranque;
        const cruzaMedianoche = name === 'cruza_medianoche' ? newValue : newFormData.cruza_medianoche;
        
        if (horaParo && horaArranque && !validateTimes(horaParo, horaArranque, cruzaMedianoche)) {
          if (cruzaMedianoche) {
            alert('⚠️ ALERTA: Cuando el paro cruza medianoche, la hora de arranque debe ser menor que la hora de paro (arranque al día siguiente)');
          } else {
            alert('⚠️ ALERTA: La hora de arranque no puede ser anterior o igual a la hora de paro. Verifica si el paro cruza medianoche.');
          }
        }
      }

      if (name !== 'estacion' && name !== 'modoFalla' && name !== 'categoria' && name !== 'hora_paro' && name !== 'hora_arranque' && name !== 'descripcion' && name !== 'descripcionModoFalla' && name !== 'cruza_medianoche') {
        localStorage.setItem(name, newValue);
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
    
    // Validación final de tiempos antes de enviar
    if (formData.hora_paro && formData.hora_arranque) {
      if (!validateTimes(formData.hora_paro, formData.hora_arranque, formData.cruza_medianoche)) {
        if (formData.cruza_medianoche) {
          alert('⚠️ ERROR: Cuando el paro cruza medianoche, la hora de arranque debe ser menor que la hora de paro. Por favor corrige los tiempos.');
        } else {
          alert('⚠️ ERROR: La hora de arranque no puede ser anterior o igual a la hora de paro. Si el paro cruza medianoche, marca la casilla correspondiente.');
        }
        return;
      }
    }
    
    try {
      // Preparar datos para envío, incluyendo fecha de arranque si cruza medianoche
      const dataToSend = { ...formData };
      if (formData.cruza_medianoche) {
        const fechaParo = new Date(formData.fecha);
        const fechaArranque = new Date(fechaParo);
        fechaArranque.setDate(fechaArranque.getDate() + 1);
        dataToSend.fecha_arranque = fechaArranque.toLocaleDateString('en-CA');
      }
      
      const response = await fetch(`${serverApiUrl}/api/paros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
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
          cruza_medianoche: false,
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
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                name="cruza_medianoche" 
                checked={formData.cruza_medianoche} 
                onChange={handleChange} 
                style={styles.checkbox}
              />
              El paro cruza medianoche (arranque al día siguiente)
            </label>
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#666',
    marginTop: '5px',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },

};

export default StopRegister;