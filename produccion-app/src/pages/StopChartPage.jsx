import React, { useState, useEffect } from 'react';
import StopChart from '../components/StopChart';
import '../App.css';

const StopChartPage = () => {
  const [fecha, setFecha] = useState(localStorage.getItem('fecha') || '');
  const [area, setArea] = useState(localStorage.getItem('area') || '');
  const [areas, setAreas] = useState([]);
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    localStorage.setItem('fecha', fecha);
  }, [fecha]);

  useEffect(() => {
    localStorage.setItem('area', area);
  }, [area]);

  useEffect(() => {
    // Cargar las áreas disponibles
    const fetchAreas = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/paros`);
        if (response.ok) {
          const data = await response.json();
          const uniqueAreas = [...new Set(data.map(paro => paro[1]))].filter(Boolean);
          setAreas(uniqueAreas);
        }
      } catch (error) {
        console.error('Error fetching areas:', error);
      }
    };

    fetchAreas();
  }, [serverApiUrl]);

  return (
    <div className="main-container">
      <h1>Tiempo en Paro por Hora (Turno 7am-7am)</h1>
      <div style={styles.filters}>
        <label>Fecha:</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={styles.input}
        />
        <label>Área:</label>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={styles.select}
        >
          <option value="">Todas las áreas</option>
          {areas.map(areaOption => (
            <option key={areaOption} value={areaOption}>
              {areaOption}
            </option>
          ))}
        </select>
      </div>
      {fecha ? (
        <StopChart fecha={fecha} area={area} />
      ) : (
        <p>Seleccione una fecha para generar la gráfica.</p>
      )}
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
    padding: '10px',
    fontSize: '16px',
    width: '100%',
    maxWidth: '300px',
    borderRadius: '8px',
  },
  select: {
    padding: '10px',
    fontSize: '16px',
    width: '100%',
    maxWidth: '300px',
    borderRadius: '8px',
  },
};

export default StopChartPage;