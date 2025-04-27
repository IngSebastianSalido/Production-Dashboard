import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

const ProductionCharts = ({ serverApiUrl, config }) => {
  const [fecha, setFecha] = useState(localStorage.getItem('fecha') || '');
  const [lineasData, setLineasData] = useState({});
  const [totales, setTotales] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      if (!fecha) return;

      try {
        const response = await axios.get(`${serverApiUrl}/api/reportes/${fecha}`);
        const data = response.data;

        const lineas = {};
        const lineasTotales = {};
        data.forEach((row) => {
          const area = row[1];
          const linea = row[2];
          const pn = row[3];
          const hora = row[4];
          const piezasOk = parseInt(row[5]);
          const piezasNok = parseInt(row[6]);

          const key = `${area}-${linea}-${pn}`;
          if (!lineas[key]) {
            lineas[key] = {};
          }
          if (!lineas[key][hora]) {
            lineas[key][hora] = { ok: 0, nok: 0 };
          }
          lineas[key][hora].ok += piezasOk;
          lineas[key][hora].nok += piezasNok;

          if (!lineasTotales[key]) {
            lineasTotales[key] = { ok: 0, nok: 0 };
          }
          lineasTotales[key].ok += piezasOk;
          lineasTotales[key].nok += piezasNok;
        });

        const formattedData = {};
        Object.keys(lineas).forEach((key) => {
          const horas = Object.keys(lineas[key]).sort();
          const [area, linea, pn] = key.split('-');
          const rate = config.lineas.find(l => l.name === linea && l.pn === pn)?.rate || 0;
          const rateDos = config.lineas.find(l => l.name === linea && l.pn === pn)?.rateDos || 0;
          formattedData[key] = {
            labels: horas,
            datasets: [
              {
                label: 'Piezas OK',
                data: horas.map((hora) => lineas[key][hora].ok),
                backgroundColor: horas.map((hora) => {
                  const piezasOk = lineas[key][hora].ok;
                  if (piezasOk >= rate) {
                    return 'rgba(0, 255, 0, 0.6)';
                  } else if (piezasOk >= rateDos) {
                    return 'rgba(255, 255, 0, 0.6)';
                  } else {
                    return 'rgba(255, 0, 0, 0.6)';
                  }
                }),
                borderColor: horas.map((hora) => {
                  const piezasOk = lineas[key][hora].ok;
                  if (piezasOk >= rate) {
                    return 'rgba(0, 255, 0, 1)';
                  } else if (piezasOk >= rateDos) {
                    return 'rgba(255, 255, 0, 1)';
                  } else {
                    return 'rgba(255, 0, 0, 1)';
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

    fetchData();
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, [fecha, config, serverApiUrl]);

  useEffect(() => {
    localStorage.setItem('fecha', fecha);
  }, [fecha]);

  return (
    <div>
      <div style={styles.filters}>
        <label>Fecha:</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={styles.input}
        />
      </div>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
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

export default ProductionCharts;
