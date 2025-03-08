import React, { useState, useEffect } from 'react';
import StopChart from '../components/StopChart';
import '../App.css';

const StopChartPage = () => {
  const [fecha, setFecha] = useState(localStorage.getItem('fecha') || '');

  useEffect(() => {
    localStorage.setItem('fecha', fecha);
  }, [fecha]);

  return (
    <div className="main-container">
      <h1>Tiempo en Paro por Hora</h1>
      <div style={styles.filters}>
        <label>Fecha:</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={styles.input}
        />
      </div>
      {fecha ? <StopChart fecha={fecha} /> : <p>Seleccione una fecha para generar la gráfica.</p>}
    </div>
  );
};

const styles = {
  filters: {
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    alignItems: 'center',
  },
  input: {
    margin: '0 10px',
  },
};

export default StopChartPage;