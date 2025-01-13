import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReportForm = () => {
  const [formData, setFormData] = useState({
    fecha: '',
    area: '',
    linea: '',
    hora: '',
    piezas_ok: 0,
    piezas_nok: 0,
  });

  // Cargar valores almacenados en localStorage al montar el componente
  useEffect(() => {
    const savedData = {
      fecha: localStorage.getItem('fecha') || '',
      area: localStorage.getItem('area') || '',
      linea: localStorage.getItem('linea') || '',
    };
    setFormData((prevData) => ({ ...prevData, ...savedData }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Formatear la hora solo para horas completas (HH:00)
    if (name === 'hora') {
      const [hora] = value.split(':'); // Obtener solo la hora
      setFormData({ ...formData, [name]: `${hora}:00` }); // Asignar minutos como 00
    } else {
      setFormData({ ...formData, [name]: value });

      // Guardar en localStorage para las claves persistentes
      if (name === 'fecha' || name === 'area' || name === 'linea') {
        localStorage.setItem(name, value);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://192.168.68.165:3000/api/reportes', formData);
      alert('Reporte guardado correctamente');
    } catch (error) {
      console.error('Error al guardar el reporte:', error);
      alert('Error al guardar el reporte.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label>Fecha:</label>
        <input
          type="date"
          name="fecha"
          value={formData.fecha}
          onChange={handleChange}
          required
        />
        <label>Área:</label>
        <input
          type="text"
          name="area"
          value={formData.area}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-row">
        <label>Línea:</label>
        <input
          type="text"
          name="linea"
          value={formData.linea}
          onChange={handleChange}
          required
        />
        <label>Hora:</label>
        <input
          type="time"
          name="hora"
          value={formData.hora}
          step="3600" // Solo permite incrementos de 1 hora
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-row">
        <label>Piezas OK:</label>
        <input
          type="number"
          name="piezas_ok"
          value={formData.piezas_ok}
          onChange={handleChange}
          required
        />
        <label>Piezas NOK:</label>
        <input
          type="number"
          name="piezas_nok"
          value={formData.piezas_nok}
          onChange={handleChange}
          required
        />
      </div>

      <button type="submit">Guardar Reporte</button>
    </form>
  );
};

export default ReportForm;
