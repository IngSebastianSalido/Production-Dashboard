import React, { useState, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import './Chart1.css';
import Modal from './Modal';

const Chart1 = ({ mesSeleccionado }) => {
  // Estado para los valores editables
  const [metaValues, setMetaValues] = useState(Array(31).fill(1000));
  const [realValues, setRealValues] = useState(Array(31).fill(900));
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [currentPage, setCurrentPage] = useState(1);
  const dataGridRef = useRef(null);
  const ITEMS_PER_PAGE = 7; // Number of days to show per page
  
  // Sincronizar mesSeleccionado con el estado interno
  useEffect(() => {
    if (mesSeleccionado) {
      const [year, month] = mesSeleccionado.split('-');
      setSelectedYear(parseInt(year));
      setSelectedMonth(parseInt(month) - 1); // JavaScript months are 0-indexed
    }
  }, [mesSeleccionado]);
  
  // Cargar datos del API cuando cambia el mes o año seleccionado
  useEffect(() => {
    setLoading(true);
    
    // Crear fecha para el primer día del mes seleccionado
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const year = firstDayOfMonth.getFullYear();
    const month = String(firstDayOfMonth.getMonth() + 1).padStart(2, '0');
    const day = String(firstDayOfMonth.getDate()).padStart(2, '0');
    const fechaParam = `${year}-${month}-${day}`;
    
    // Calcular el número de días en el mes
    const numDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    setDaysInMonth(numDays);
    
    // Obtener datos reales del CSV vía la API de backend
    // Obtener URL del servidor desde env o fallback a la URL actual
    const apiUrl = import.meta.env.VITE_SERVER_API_URL || `http://${window.location.hostname}:3000`;
    fetch(`${apiUrl}/api/efficiency/${fechaParam}`)
      .then(response => {
        if (!response.ok) throw new Error('Error al obtener datos de eficiencia');
        return response.json();
      })
      .then(data => {
        // Asegurar tamaño correcto y asignar valores
        const metaArray = Array(numDays).fill(0);
        const realArray = Array(numDays).fill(0);
        if (data.metaValues && data.realValues) {
          for (let i = 0; i < Math.min(numDays, data.metaValues.length); i++) {
            metaArray[i] = Number(data.metaValues[i]) || 0;
            realArray[i] = Number(data.realValues[i]) || 0;
          }
        }
        setMetaValues(metaArray);
        setRealValues(realArray);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error al cargar datos de eficiencia:', error);
        setMetaValues(Array(numDays).fill(0));
        setRealValues(Array(numDays).fill(0));
        setLoading(false);
      });
  }, [selectedMonth, selectedYear]);
  
  // Reset scroll position when modal opens
  useEffect(() => {
    if (modalOpen && dataGridRef.current) {
      dataGridRef.current.scrollLeft = 0;
      setCurrentPage(1);
    }
  }, [modalOpen]);
  
  // Calcular los porcentajes
  const percentValues = realValues.map((real, index) => 
    metaValues[index] > 0 ? Math.round((real / metaValues[index]) * 100) : 0
  );

  // Generar etiquetas para los días del mes
  const generateDaysOfMonth = () => {
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(selectedYear, selectedMonth, i);
      const dayNumber = day.getDate();
      const dayName = dayNames[day.getDay()];
      days.push(`${dayName} ${dayNumber}`);
    }
    return days;
  };

  // Meses en español para selector
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  // Datos para la gráfica - usar datos del servidor en lugar de datos de ejemplo
  const chartDataMini = {
    labels: generateDaysOfMonth().slice(0, 7),
    datasets: [
      {
        label: 'Eficiencia (%)',
        data: percentValues.slice(0, 7),
        backgroundColor: percentValues.slice(0, 7).map(value => {
          if (value >= 90) return 'rgba(0, 200, 0, 0.6)'; // Verde si es >= 90%
          if (value >= 80) return 'rgba(255, 255, 0, 0.6)'; // Amarillo si es >= 80%
          return 'rgba(255, 0, 0, 0.6)'; // Rojo en otro caso
        }),
        borderColor: percentValues.slice(0, 7).map(value => {
          if (value >= 90) return 'rgba(0, 200, 0, 1)';
          if (value >= 80) return 'rgba(255, 255, 0, 1)';
          return 'rgba(255, 0, 0, 1)';
        }),
        borderWidth: 1,
      }
    ],
  };
  
  // Datos completos para el modal
  const chartDataFull = {
    labels: generateDaysOfMonth(),
    datasets: [
      {
        label: 'Eficiencia (%)',
        data: percentValues,
        backgroundColor: percentValues.map(value => {
          if (value >= 90) return 'rgba(0, 200, 0, 0.6)'; // Verde si es >= 90%
          if (value >= 80) return 'rgba(255, 255, 0, 0.6)'; // Amarillo si es >= 80%
          return 'rgba(255, 0, 0, 0.6)'; // Rojo en otro caso
        }),
        borderColor: percentValues.map(value => {
          if (value >= 90) return 'rgba(0, 200, 0, 1)';
          if (value >= 80) return 'rgba(255, 255, 0, 1)';
          return 'rgba(255, 0, 0, 1)';
        }),
        borderWidth: 1,
      }
    ],
  };
  
  // Manejar cambios en los inputs
  const handleMetaChange = (index, value) => {
    const newValues = [...metaValues];
    newValues[index] = value ? parseInt(value) : 0;
    setMetaValues(newValues);
  };

  const handleRealChange = (index, value) => {
    const newValues = [...realValues];
    newValues[index] = value ? parseInt(value) : 0;
    setRealValues(newValues);
  };
  
  // Función para guardar mes completo en backend
  const saveDataToServer = async () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const y = firstDay.getFullYear();
    const m = String(firstDay.getMonth() + 1).padStart(2, '0');
    const d = String(firstDay.getDate()).padStart(2, '0');
    const fecha = `${y}-${m}-${d}`;
    const apiUrl = import.meta.env.VITE_SERVER_API_URL || `http://${window.location.hostname}:3000`;
    const response = await fetch(`${apiUrl}/api/efficiency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, metaValues, realValues }),
    });
    if (!response.ok) throw new Error('Error al guardar datos de eficiencia');
    return response.text();
  };
  
  // Guardar mes completo al pulsar el botón
  const handleSaveClick = async () => {
    setLoading(true);
    try {
      await saveDataToServer();
      // Recargar mes completo
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      const y = firstDay.getFullYear();
      const m = String(firstDay.getMonth() + 1).padStart(2, '0');
      const d = String(firstDay.getDate()).padStart(2, '0');
      reloadData(`${y}-${m}-${d}`);
      alert('Mes guardado correctamente');
    } catch (error) {
      console.error(error);
      alert('Error al guardar datos');
    } finally {
      setLoading(false);
    }
  };
  
  // Función para recargar datos
  const reloadData = (fechaParam) => {
    setLoading(true);
    const apiUrl = import.meta.env.VITE_SERVER_API_URL || `http://${window.location.hostname}:3000`;
    fetch(`${apiUrl}/api/efficiency/${fechaParam}`)
      .then(response => {
        if (!response.ok) throw new Error('Error al obtener datos de eficiencia');
        return response.json();
      })
      .then(data => {
        // Asegurarse de que los arrays tienen el tamaño correcto para el mes
        const metaArray = Array(daysInMonth).fill(0);
        const realArray = Array(daysInMonth).fill(0);
        
        // Llenar con datos recibidos si existen
        for (let i = 0; i < Math.min(daysInMonth, data.metaValues.length); i++) {
          metaArray[i] = data.metaValues[i] || 0;
          realArray[i] = data.realValues[i] || 0;
        }
        
        setMetaValues(metaArray);
        setRealValues(realArray);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error al recargar datos de eficiencia:", error);
        setLoading(false);
      });
  };
  
  // Opciones comunes para los gráficos (miniatura y modal)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: 'white',
    scales: {
      y: {
        beginAtZero: true,
        max: 100, // Máximo 100%
        title: {
          display: true,
          text: 'Eficiencia (%)',
          color: 'white'
        },
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Día del mes',
          color: 'white'
        },
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: 'white'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          afterLabel: function(context) {
            const index = context.dataIndex;
            return [
              `Meta: ${metaValues[index]}`,
              `Real: ${realValues[index]}`,
              `Porcentaje: ${percentValues[index]}%`
            ];
          }
        }
      }
    }
  };
  
  // Calcular el promedio de eficiencia de valores no cero
  const calculateAverage = (values) => {
    const nonZeroValues = values.filter(value => value > 0);
    if (nonZeroValues.length === 0) return 0;
    return Math.round(nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length);
  };
  
  // Calculate total pages based on days in month
  const totalPages = Math.ceil(daysInMonth / ITEMS_PER_PAGE);
  
  // Get current page items
  const getCurrentPageItems = () => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, daysInMonth);
    return generateDaysOfMonth().slice(startIdx, endIdx);
  };
  
  // Get current values for the page
  const getCurrentPageValues = (allValues) => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, daysInMonth);
    return allValues.slice(startIdx, endIdx);
  };
  
  // Page navigation
  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };
  
  return (
    <>
      <div className="chart-card" onClick={() => setModalOpen(true)}>
        <h3>Eficiencia de Línea</h3>
        
        {loading ? (
          <div className="chart-loading">
            <div className="chart-loading-spinner"></div>
            <p>Cargando datos...</p>
          </div>
        ) : (
          <>
            {/* Miniatura de la gráfica con datos reales */}
            <div className="chart-container">
              <Bar
                data={chartDataMini}
                options={chartOptions}
              />
            </div>
            
            {/* Miniatura de la rejilla de datos */}
            <div className="data-grid-mini">
              <div className="mini-summary">
                <p>{monthNames[selectedMonth]} {selectedYear}</p>
                <p>Promedio: {calculateAverage(percentValues)}%</p>
                <p>Click para ver detalles</p>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Modal para la versión expandida */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title="Eficiencia de Línea"
      >
        <div className="month-selector">
          <div className="selector-controls">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="month-select"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="year-select"
            >
              {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <h4>{monthNames[selectedMonth]} {selectedYear}</h4>
        </div>        <div className="modal-chart-container">
          <Bar
            data={chartDataFull}
            options={{
              ...chartOptions,
              maintainAspectRatio: false,
              responsive: true,
              layout: {
                padding: 0
              },
              interaction: {
                intersect: false,
                mode: 'index'
              }
            }}
          />
        </div>
        
        <div className="modal-data-section">
          <div className="data-grid-pagination">
            <button 
              onClick={() => goToPage(1)} 
              disabled={currentPage === 1}
              className="page-button"
            >
              &lt;&lt;
            </button>
            <button 
              onClick={() => goToPage(currentPage - 1)} 
              disabled={currentPage === 1}
              className="page-button"
            >
              &lt;
            </button>
            <span className="page-indicator">
              Página {currentPage} de {totalPages} ({(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, daysInMonth)} de {daysInMonth} días)
            </span>
            <button 
              onClick={() => goToPage(currentPage + 1)} 
              disabled={currentPage === totalPages}
              className="page-button"
            >
              &gt;
            </button>
            <button 
              onClick={() => goToPage(totalPages)} 
              disabled={currentPage === totalPages}
              className="page-button"
            >
              &gt;&gt;
            </button>
          </div>
          
          <div className="data-grid" ref={dataGridRef}>
            {getCurrentPageItems().map((day, pageIndex) => {
              const index = (currentPage - 1) * ITEMS_PER_PAGE + pageIndex;
              return (
                <div key={index} className="day-column">
                  <div className="day-header">{day}</div>
                  <div className="input-container">
                    <div className="input-label">Meta</div>
                    <input
                      type="number"
                      className="data-input meta"
                      value={metaValues[index]}
                      onChange={(e) => handleMetaChange(index, e.target.value)}
                      placeholder="Meta"
                    />
                  </div>
                  <div className="input-container">
                    <div className="input-label">Real</div>
                    <input
                      type="number"
                      className="data-input real"
                      value={realValues[index]}
                      onChange={(e) => handleRealChange(index, e.target.value)}
                      placeholder="Real"
                    />
                  </div>
                  <div className="input-container">
                    <div className="input-label">%</div>
                    <div 
                      className={`percent-box ${
                        percentValues[index] >= 90 ? 'percent-high' : 
                        percentValues[index] >= 80 ? 'percent-medium' : 
                        'percent-low'
                      }`}
                    >
                      {percentValues[index]}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="chart-details">
            <h4>Resumen de Eficiencia</h4>
            <p>Promedio de Eficiencia: {calculateAverage(percentValues)}%</p>
            <p>Meta Total: {metaValues.reduce((a, b) => a + b, 0)}</p>
            <p>Producción Real Total: {realValues.reduce((a, b) => a + b, 0)}</p>
          </div>

          <div className="modal-actions">
            <button className="save-button" onClick={handleSaveClick}>Guardar</button>
            <button className="cancel-button" onClick={() => setModalOpen(false)}>Cerrar</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Chart1;
