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
  const [config, setConfig] = useState({}); // Store configuration data
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    // Fetch configuration data
    const fetchConfig = async () => {
      try {
        const response = await axios.get(`${serverApiUrl}/api/opciones`);
        setConfig(response.data);
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };

    fetchConfig();
  }, [serverApiUrl]);

  useEffect(() => {
    const fetchData = async () => {
      if (!fecha) return;

      try {
        const response = await axios.get(`${serverApiUrl}/api/reportes/${fecha}`);
        const data = response.data;

        // Agrupar datos por área, línea, PN y hora
        const lineas = {};
        const lineasTotales = {};
        data.forEach((row) => {
          const area = row[1]; // Área
          const linea = row[2]; // Línea
          const pn = row[3]; // PN
          const hora = row[4]; // Hora
          const piezasOk = parseInt(row[5]);
          const piezasNok = parseInt(row[6]);

          // Agrupar datos por área, línea, PN y hora
          const key = `${area}-${linea}-${pn}`;
          if (!lineas[key]) {
            lineas[key] = {};
          }
          if (!lineas[key][hora]) {
            lineas[key][hora] = { ok: 0, nok: 0 };
          }
          lineas[key][hora].ok += piezasOk;
          lineas[key][hora].nok += piezasNok;

          // Calcular totales por área, línea y PN
          if (!lineasTotales[key]) {
            lineasTotales[key] = { ok: 0, nok: 0 };
          }
          lineasTotales[key].ok += piezasOk;
          lineasTotales[key].nok += piezasNok;
        });

        // Formatear los datos para Chart.js
        const formattedData = {};
        Object.keys(lineas).forEach((key) => {
          const horas = Object.keys(lineas[key]).sort(); // Ordenar horas
          const [area, linea, pn] = key.split('-');
          const rate = config.lineas.find(l => l.name === linea && l.pn === pn)?.rate || 0; // Get the rate from config
          const rateDos = config.lineas.find(l => l.name === linea && l.pn === pn)?.rateDos || 0; // Get the rateDos from config
          formattedData[key] = {
            labels: horas,
            datasets: [
              {
                label: 'Piezas OK',
                data: horas.map((hora) => lineas[key][hora].ok),
                backgroundColor: horas.map((hora) => {
                  const piezasOk = lineas[key][hora].ok;
                  if (piezasOk >= rate) {
                    return 'rgba(0, 255, 0, 0.6)'; // Verde
                  } else if (piezasOk >= rateDos) {
                    return 'rgba(255, 255, 0, 0.6)'; // Amarillo
                  } else {
                    return 'rgba(255, 0, 0, 0.6)'; // Rojo
                  }
                }),
                borderColor: horas.map((hora) => {
                  const piezasOk = lineas[key][hora].ok;
                  if (piezasOk >= rate) {
                    return 'rgba(0, 255, 0, 1)'; // Verde
                  } else if (piezasOk >= rateDos) {
                    return 'rgba(255, 255, 0, 1)'; // Amarillo
                  } else {
                    return 'rgba(255, 0, 0, 1)'; // Rojo
                  }
                }),
                borderWidth: 1,
              },
              {
                label: 'Piezas NOK',
                data: horas.map((hora) => lineas[key][hora].nok),
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
  }, [fecha, config, serverApiUrl]);

  // Guardar fecha en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('fecha', fecha);
  }, [fecha]);

  return (
    <div className="main-container">
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
          Object.keys(lineasData).map((key) => {
            const [area, linea, pn] = key.split('-');
            return (
              <div key={key} style={styles.card}>
                <h2 style={styles.lineTitle}>
                  Área: {area} - Línea: {linea} - PN: {pn} -{' '}
                  <span style={{ color: 'green' }}>Total OK: {totales[key]?.ok || 0}</span>,{' '}
                  <span style={{ color: 'red' }}>Total NOK: {totales[key]?.nok || 0}</span>
                </h2>
                <div style={styles.chart}>
                  <Bar
                    data={lineasData[key]}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                        y1: {
                          beginAtZero: true,
                          display: false,
                        },
                      },
                    }}
                  />
                </div>
              </div>
            );
          })
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