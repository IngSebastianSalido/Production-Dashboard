import React, { useState, useEffect, Suspense } from 'react';
import 'chart.js/auto';
import '../ProductionBoard.css';
import Chart1 from '../components/Chart1';

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
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">Panel de Producción</h1>
        <p className="page-subtitle">Visualización de métricas y eficiencia de producción</p>
      </div>
      
      <div className="panel">
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="mes">Mes:</label>
            <input
              type="month"
              id="mes"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            />
          </div>
          
          <div className="date-display" style={{ color: '#fff', fontSize: '16px', fontWeight: '500' }}>
            {formatMonth(mesSeleccionado)}
          </div>
          
          <button 
            className="btn btn-info"
            onClick={() => setShowInfo(!showInfo)}
          >
            {showInfo ? 'Ocultar Info' : 'Mostrar Info'}
          </button>
        </div>
      </div>
      
      {showInfo && (
        <div className="panel">
          <div className="panel-header">
            <h2>Información del Panel</h2>
          </div>
          <p style={{ marginBottom: '15px' }}>Este panel muestra diferentes métricas de producción. Seleccione una fecha para ver los datos correspondientes.</p>
          <p style={{ marginBottom: '15px' }}>Haga click en cualquier gráfico para ver más detalles y análisis.</p>
          <p style={{ marginBottom: '10px', fontWeight: '600' }}>Las gráficas incluyen:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Eficiencia de Línea:</strong> Muestra la eficiencia diaria comparando valores reales vs. metas.</li>
          </ul>
        </div>
      )}
      
      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      ) : (
        <div className="panel">
          <div className="charts-container">
            <Chart1 
              mesSeleccionado={mesSeleccionado} 
            />
          </div>
        </div>
      )}
      
      <footer className="dashboard-footer">
        <p>© 2025 Production Dashboard</p>
      </footer>
    </div>
  );
};

export default ProductionBoard;
