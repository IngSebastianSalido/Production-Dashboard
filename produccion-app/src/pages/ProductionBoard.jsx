import React, { useState, useEffect, Suspense } from 'react';
import 'chart.js/auto';
import '../ProductionBoard.css';
import Chart1 from '../components/Chart1';
import Chart2 from '../components/Chart2'; // Usando CycleTimeChart en lugar de Chart2
import Chart3 from '../components/Chart3';

const ProductionBoard = () => {
  // Estado para mes y año (por defecto mes actual)
  const getTodayMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };
  
  const [mesSeleccionado, setMesSeleccionado] = useState(getTodayMonth());
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Simular carga de datos
  const loadData = () => {
    setLoading(true);
    // Simulamos una carga de datos (en producción aquí iría una llamada a API)
    setTimeout(() => {
      setLoading(false);
    }, 800);
  };
  // Inicializar y guardar fecha en localStorage
  useEffect(() => {
    // Recuperar fecha guardada o usar la actual
    const savedDate = localStorage.getItem('mesSeleccionado');
    if (savedDate) {
      setMesSeleccionado(savedDate);
    }
    
    // Cargar datos al iniciar
    loadData();
  }, []);

  // Cuando cambia la fecha
  useEffect(() => {
    localStorage.setItem('mesSeleccionado', mesSeleccionado);
    loadData();
  }, [mesSeleccionado]);
  // Formatear mes para mostrar
  const formatMonth = (monthString) => {
    const [year, month] = monthString.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };
  return (
    <div className="production-board-container">
      <h1 className="production-board-title">Panel de Producción</h1>
        <div className="dashboard-header">
        <div className="date-picker">
          <label htmlFor="mes">Mes: </label>
          <input
            type="month"
            id="mes"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
          />
        </div>
        
        <div className="date-display">
          {formatMonth(mesSeleccionado)}
        </div>
        
        <button 
          className="info-button"
          onClick={() => setShowInfo(!showInfo)}
        >
          {showInfo ? 'Ocultar Info' : 'Mostrar Info'}
        </button>
      </div>
      
      {showInfo && (
        <div className="info-panel">
          <h3>Información del Panel</h3>
          <p>Este panel muestra diferentes métricas de producción. Seleccione una fecha para ver los datos correspondientes.</p>
          <p>Haga click en cualquier gráfico para ver más detalles y análisis.</p>
          <p>Las gráficas incluyen:</p>
          <ul>
            <li><strong>Eficiencia de Línea:</strong> Muestra la eficiencia diaria comparando valores reales vs. metas.</li>
            <li><strong>Tiempo de Ciclo:</strong> Tiempo promedio de ciclo por día comparado con el objetivo.</li>
            <li><strong>Causas de Defectos:</strong> Análisis de las principales causas de defectos en la producción.</li>
          </ul>
        </div>
      )}
      
      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      ) : (        <div className="charts-grid">
          {/* Chart 1 */}
          <Chart1 
            mesSeleccionado={mesSeleccionado} 
          />
          
          {/* Chart 2 */}
          <Chart2 
            mesSeleccionado={mesSeleccionado} 
          />
          
          {/* Chart 3 */}
          <Chart3 
            mesSeleccionado={mesSeleccionado}
          />
        </div>
      )}
      
      <footer className="dashboard-footer">
        <p>© 2025 Production Dashboard</p>
      </footer>
    </div>
  );
};

export default ProductionBoard;
