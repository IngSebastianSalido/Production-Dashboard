import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './App.css';

// Registrar componentes requeridos para Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const App = () => {
  const [fecha, setFecha] = useState(localStorage.getItem('fecha') || ''); // Recuperar fecha del localStorage
  const [lineasData, setLineasData] = useState({});
  const [totales, setTotales] = useState({}); // Guardar los totales de piezas OK y NOK

  useEffect(() => {
    const fetchData = async () => {
      if (!fecha) return;

      try {
        const response = await axios.get(`http://192.168.68.165:3000/api/reportes/${fecha}`);
        const data = response.data;

        // Agrupar datos por línea y por hora
        const lineas = {};
        const lineasTotales = {};
        data.forEach((row) => {
          const linea = row[2]; // Línea
          const hora = row[3]; // Hora
          const piezasOk = parseInt(row[4]);
          const piezasNok = parseInt(row[5]);

          // Agrupar datos por línea y hora
          if (!lineas[linea]) {
            lineas[linea] = {};
          }
          if (!lineas[linea][hora]) {
            lineas[linea][hora] = { ok: 0, nok: 0 };
          }
          lineas[linea][hora].ok += piezasOk;
          lineas[linea][hora].nok += piezasNok;

          // Calcular totales por línea
          if (!lineasTotales[linea]) {
            lineasTotales[linea] = { ok: 0, nok: 0 };
          }
          lineasTotales[linea].ok += piezasOk;
          lineasTotales[linea].nok += piezasNok;
        });

        // Formatear los datos para Chart.js
        const formattedData = {};
        Object.keys(lineas).forEach((linea) => {
          const horas = Object.keys(lineas[linea]).sort(); // Ordenar horas
          formattedData[linea] = {
            labels: horas,
            datasets: [
              {
                label: 'Piezas OK',
                data: horas.map((hora) => lineas[linea][hora].ok),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
              },
              {
                label: 'Piezas NOK',
                data: horas.map((hora) => lineas[linea][hora].nok),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
              },
            ],
          };
        });

        setLineasData(formattedData);
        setTotales(lineasTotales);
      } catch (error) {
        console.error('Error al obtener los datos:', error);
      }
    };

    // Llamar a la API periódicamente
    fetchData(); // Llamada inicial
    const interval = setInterval(fetchData, 30000); // Actualizar cada 30 segundos

    return () => clearInterval(interval); // Limpiar el intervalo al desmontar
  }, [fecha]);

  // Guardar fecha en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('fecha', fecha);
  }, [fecha]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Resumen de Producción por Hora</h1>

      {/* Filtros */}
      <div style={styles.filters}>
        <label>Fecha:</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={styles.input}
        />
      </div>

      {/* Gráficas por línea en diseño tipo Grid */}
      <div style={styles.grid}>
        {Object.keys(lineasData).length > 0 ? (
          Object.keys(lineasData).map((linea) => (
            <div key={linea} style={styles.card}>
              <h2 style={styles.lineTitle}>
                Línea: {linea} -{' '}
                <span style={{ color: 'green' }}>Total OK: {totales[linea]?.ok || 0}</span>,{' '}
                <span style={{ color: 'red' }}>Total NOK: {totales[linea]?.nok || 0}</span>
              </h2>
              <div style={styles.chart}>
                <Bar data={lineasData[linea]} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          ))
        ) : (
          <p>Seleccione una fecha para generar las gráficas.</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    paddingTop: '60px', // Add padding to the top to create space for the menu
    textAlign: 'center',
    width: '100%',
  },
  title: {
    marginBottom: '20px',
    whiteSpace: 'nowrap', // Prevent title from being cut off
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', // Responsive grid with a maximum of 2 columns
    gap: '20px',
  },
  card: {
    backgroundColor: '#333',
    padding: '20px',
    borderRadius: '10px',
    color: 'white',
    textAlign: 'center',
  },
  lineTitle: {
    marginBottom: '15px',
  },
  chart: {
    height: '300px',
  },
};

export default App;