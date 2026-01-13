import React, { useState, useEffect } from 'react';
import { parseYYYYMMDD, formatYYYYMMDD } from '../utils/dateUtils';
import '../REA.css';

const StopRegister = ({
  serverApiUrl,
  options,
  categories,
  onRegister = () => {},
  initialData = null,
  mode = 'create',
  onCancel,
  submitLabel,
  isSubmitting = false,
}) => {
  const isEditMode = mode === 'edit';
  const safeOptions = {
    areas: options?.areas ?? [],
    lineas: options?.lineas ?? [],
    estaciones: options?.estaciones ?? [],
    modosFalla: options?.modosFalla ?? [],
  };
  const safeCategories = Array.isArray(categories) ? categories : [];

  const buildEmptyState = () => ({
    fecha: '',
    area: '',
    linea: '',
    pn: '',
    estacion: '',
    modoFalla: '',
    descripcionModoFalla: '',
    categoria: '',
    hora_paro: '',
    hora_arranque: '',
    descripcion: '',
    cruza_medianoche: false,
    ajuste_proceso: false,
  });

  const buildCreateDefaults = () => ({
    ...buildEmptyState(),
    area: localStorage.getItem('area') || '',
    linea: localStorage.getItem('linea') || '',
    pn: localStorage.getItem('pn') || '',
  });

  const resolveInitialState = () => {
    if (initialData) {
      return { ...buildEmptyState(), ...initialData };
    }
    return buildCreateDefaults();
  };

  const [formData, setFormData] = useState(resolveInitialState);
  const [productionPn, setProductionPn] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({ ...buildEmptyState(), ...initialData });
    }
  }, [initialData]);

  useEffect(() => {
    if (isEditMode) return;
    const now = new Date();
    const todayStr = formatYYYYMMDD(now);
    setFormData((prevFormData) => ({
      ...prevFormData,
      fecha: todayStr,
      hora_paro: now.toTimeString().slice(0, 5),
      hora_arranque: '', // Inicializar hora de arranque como vacío
    }));
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    const fetchProductionPn = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/rea-production`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const latestEntry = Array.isArray(result) && result.length > 0 ? result[0] : null;
        const pnFromReport = latestEntry?.pn?.trim();
        if (pnFromReport) {
          setProductionPn(pnFromReport);
          setFormData((prevFormData) => {
            const updated = { ...prevFormData, pn: pnFromReport };
            localStorage.setItem('pn', pnFromReport);
            return updated;
          });
        }
      } catch (error) {
        console.error('Error al obtener PN desde ProductionReport:', error);
      }
    };

    fetchProductionPn();
  }, [serverApiUrl, isEditMode]);

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

  // Calcula la duración en minutos entre hora_paro y hora_arranque
  const computeDurationMinutes = (horaParo, horaArranque, cruzaMedianoche) => {
    if (!horaParo || !horaArranque) return 0;
    const [h1, m1] = horaParo.split(':').map(Number);
    const [h2, m2] = horaArranque.split(':').map(Number);
    const start = (isNaN(h1) ? 0 : h1) * 60 + (isNaN(m1) ? 0 : m1);
    let end = (isNaN(h2) ? 0 : h2) * 60 + (isNaN(m2) ? 0 : m2);
    if (cruzaMedianoche || end <= start) end += 24 * 60; // considerar cruce de medianoche
    return end - start;
  };

  const crossesMidnight = (horaParo, horaArranque) => {
    if (!horaParo || !horaArranque) return false;
    const [h1, m1] = horaParo.split(':').map(Number);
    const [h2, m2] = horaArranque.split(':').map(Number);
    if (Number.isNaN(h1) || Number.isNaN(h2)) return false;
    if (h2 < h1) return true;
    if (h2 === h1) {
      const startMin = Number.isNaN(m1) ? 0 : m1;
      const endMin = Number.isNaN(m2) ? 0 : m2;
      return endMin <= startMin;
    }
    return false;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData((prevFormData) => {
      const newFormData = { ...prevFormData, [name]: newValue };

      if (name === 'area') {
        newFormData.linea = '';
        newFormData.pn = '';
        if (!isEditMode) {
          localStorage.removeItem('linea');
          localStorage.removeItem('pn');
        }
      } else if (name === 'linea') {
        newFormData.pn = '';
        if (!isEditMode) {
          localStorage.removeItem('pn');
        }
      }

      // Validación visual se realizará al enviar para evitar interrupciones durante la edición

      if (!isEditMode && name !== 'estacion' && name !== 'modoFalla' && name !== 'categoria' && name !== 'hora_paro' && name !== 'hora_arranque' && name !== 'descripcion' && name !== 'descripcionModoFalla' && name !== 'cruza_medianoche') {
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
    let durationMinutes = 0;
    let shouldWarnMidnight = false;

    if (formData.hora_paro && formData.hora_arranque) {
      if (!validateTimes(formData.hora_paro, formData.hora_arranque, formData.cruza_medianoche)) {
        if (formData.cruza_medianoche) {
          alert('⚠️ ERROR: Cuando el paro cruza medianoche, la hora de arranque debe ser menor que la hora de paro. Por favor corrige los tiempos.');
        } else {
          alert('⚠️ ERROR: La hora de arranque no puede ser anterior o igual a la hora de paro. Si el paro cruza medianoche, marca la casilla correspondiente.');
        }
        return;
      }

      durationMinutes = computeDurationMinutes(
        formData.hora_paro,
        formData.hora_arranque,
        formData.cruza_medianoche
      );
      shouldWarnMidnight = formData.cruza_medianoche || crossesMidnight(formData.hora_paro, formData.hora_arranque);

      const warningReasons = [];
      if (shouldWarnMidnight) {
        warningReasons.push('cruza medianoche');
      }
      if (durationMinutes > 60) {
        warningReasons.push(`dura ${durationMinutes} minutos (> 60)`);
      }

      if (warningReasons.length > 0) {
        const message = `El paro ${warningReasons.join(' y ')}. ¿Deseas continuar con el registro?`;
        const proceed = window.confirm(message);
        if (!proceed) return; // usuario decide seguir editando
      }
    }
    
    try {
      // Preparar datos para envío, incluyendo fecha de arranque si cruza medianoche
      const dataToSend = { ...formData };
      if (formData.cruza_medianoche) {
        const fechaParo = parseYYYYMMDD(formData.fecha);
        if (fechaParo) {
          const fechaArranque = new Date(fechaParo);
          fechaArranque.setDate(fechaArranque.getDate() + 1);
          dataToSend.fecha_arranque = formatYYYYMMDD(fechaArranque);
        }
      }

      if (isEditMode) {
        await onRegister(dataToSend);
        return;
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
          ajuste_proceso: false,
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

  const uniqueLineas = Array.from(new Set(safeOptions.lineas.map(linea => linea.name)));
  const uniqueModosFalla = Array.from(new Set(safeOptions.modosFalla.map(modoFalla => modoFalla.name)));
  const filteredDescripcionesModoFalla = safeOptions.modosFalla.filter(modoFalla => modoFalla.name === formData.modoFalla && modoFalla.parent === formData.estacion);
  const pnOptions = safeOptions.lineas
    .filter(linea => linea.name === formData.linea)
    .map((linea, index) => ({
      key: `${linea.name}-${linea.pn}-${index}`,
      value: linea.pn,
      label: linea.pn,
    }));
  const submitText = isSubmitting ? 'Guardando...' : (submitLabel || (isEditMode ? 'Actualizar Paro' : 'Registrar Paro'));

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {!isEditMode && productionPn && (
        <h3 className="rea-pn" style={{ textAlign: 'center' }}>
          Número de Parte (ProductionReport): {productionPn}
        </h3>
      )}
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
              {safeOptions.areas.map((area, index) => (
                <option key={index} value={area.name}>{area.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>Línea:</label>
            <select name="linea" value={formData.linea} onChange={handleChange} style={styles.select}>
              <option value="">Seleccionar Línea</option>
              {uniqueLineas.filter(linea => safeOptions.lineas.some(l => l.name === linea && l.parent === formData.area)).map((linea, index) => (
                <option key={index} value={linea}>{linea}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>PN:</label>
            <select name="pn" value={formData.pn} onChange={handleChange} style={styles.select}>
              <option value="">Seleccionar PN</option>
              {productionPn && (
                <option value={productionPn}>{`ProductionReport (${productionPn})`}</option>
              )}
              {pnOptions.map(option => (
                <option key={option.key} value={option.value}>{option.label}</option>
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
              {safeOptions.estaciones.filter(estacion => estacion.parent === formData.linea).map((estacion, index) => (
                <option key={index} value={estacion.name}>{estacion.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>Modo de Falla:</label>
            <select name="modoFalla" value={formData.modoFalla} onChange={handleChange} style={styles.select}>
              <option value="">Seleccionar Modo de Falla</option>
              {uniqueModosFalla.filter(modoFalla => safeOptions.modosFalla.some(m => m.name === modoFalla && m.parent === formData.estacion)).map((modoFalla, index) => (
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
              {safeCategories.map((categoria, index) => (
                <option key={index} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label>Descripción:</label>
            <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} style={styles.textarea} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                name="ajuste_proceso" 
                checked={formData.ajuste_proceso} 
                onChange={handleChange} 
                style={styles.checkbox}
              />
              Ajuste de Proceso Crítico
            </label>
          </div>
        </div>
      </div>
      <div style={styles.buttonRow}>
        {onCancel && (
          <button
            type="button"
            style={{ ...styles.secondaryButton, opacity: isSubmitting ? 0.6 : 1 }}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          style={{ ...styles.button, opacity: isSubmitting ? 0.6 : 1 }}
          disabled={isSubmitting}
        >
          {submitText}
        </button>
      </div>
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
  buttonRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '10px',
  },
  secondaryButton: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '5px',
    cursor: 'pointer',
  },

};

export default StopRegister;
