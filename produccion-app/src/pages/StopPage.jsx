import React, { useState } from 'react';

const StopPage = () => {
  const [formData, setFormData] = useState({
    area: '',
    linea: '',
    estacion: '',
    hora_paro: '',
    hora_arranque: '',
    descripcion: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Enviar datos al backend
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

  return (
    <div style={styles.container}>
      <h1>Registrar Paro de Línea</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Primera fila: Área, Línea y Estación */}
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label>Área:</label>
            <input
              type="text"
              name="area"
              value={formData.area}
              onChange={handleChange}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label>Línea:</label>
            <input
              type="text"
              name="linea"
              value={formData.linea}
              onChange={handleChange}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label>Estación:</label>
            <input
              type="text"
              name="estacion"
              value={formData.estacion}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Segunda fila: Hora de Paro y Hora de Arranque */}
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label>Hora de Paro:</label>
            <input
              type="time"
              name="hora_paro"
              value={formData.horaParo}
              onChange={handleChange}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label>Hora de Arranque:</label>
            <input
              type="time"
              name="hora_arranque"
              value={formData.horaArranque}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Descripción */}
        <div style={styles.formGroup}>
          <label>Descripción:</label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            required
            style={{ width: '100%', height: '80px' }}
          />
        </div>

        <button type="submit" style={styles.button}>
          Registrar Paro
        </button>
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
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
  },
  formGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
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
