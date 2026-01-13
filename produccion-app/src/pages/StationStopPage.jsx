import React, { useState, useEffect } from 'react';
import StationStopChart from '../components/StationStopChart';
import './StationStopPage.css';

const StationStopPage = () => {
  const [areasUnicas, setAreasUnicas] = useState([]);
  const [lineasUnicas, setLineasUnicas] = useState([]);
  const [pnsUnicos, setPnsUnicos] = useState([]);
  const [categoriasUnicas, setCategoriasUnicas] = useState([]);
  const [estacionesOrden, setEstacionesOrden] = useState([]); // Orden de estaciones del JSON
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para los filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [areaSeleccionada, setAreaSeleccionada] = useState('');
  const [lineaSeleccionada, setLineaSeleccionada] = useState('');
  const [pnSeleccionado, setPnSeleccionado] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [paroProgramadoSeleccionado, setParoProgramadoSeleccionado] = useState('');
  const [ordenSeleccionado, setOrdenSeleccionado] = useState('tiempo'); // 'tiempo' o 'json'

  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  // Cargar opciones de filtros y paros para obtener valores únicos
  useEffect(() => {
    const fetchUniqueValues = async () => {
      try {
        // Obtener opciones (áreas y líneas)
        const opcionesResponse = await fetch(`${serverApiUrl}/api/opciones`);
        if (!opcionesResponse.ok) throw new Error('Error al cargar opciones');
        const opcionesData = await opcionesResponse.json();
        
        // Extraer áreas únicas
        const areasSet = new Set();
        if (opcionesData.areas) {
          opcionesData.areas.forEach(area => {
            const areaName = area.name || area;
            if (areaName) areasSet.add(areaName);
          });
        }
        setAreasUnicas([...areasSet].sort());
        
        // Extraer líneas únicas
        const lineasSet = new Set();
        if (opcionesData.lineas) {
          opcionesData.lineas.forEach(linea => {
            const lineaName = linea.name || linea;
            if (lineaName) lineasSet.add(lineaName);
          });
        }
        setLineasUnicas([...lineasSet].sort());
        
        // Extraer orden de estaciones del JSON
        const estacionesArray = [];
        if (opcionesData.estaciones) {
          opcionesData.estaciones.forEach(estacion => {
            const estacionName = estacion.name || estacion;
            if (estacionName) estacionesArray.push(estacionName);
          });
        }
        setEstacionesOrden(estacionesArray);
        
        // Obtener paros para extraer PNs únicos
        const parosResponse = await fetch(`${serverApiUrl}/api/paros`);
        if (!parosResponse.ok) throw new Error('Error al cargar paros');
        const parosData = await parosResponse.json();
        
        // Extraer PNs únicos del CSV (columna índice 3)
        const pnsSet = new Set();
        // Extraer categorías únicas del CSV (columna índice 7)
        const categoriasSet = new Set();
        parosData.forEach(row => {
          const pn = row[3];
          if (pn && pn.trim() !== '') {
            pnsSet.add(pn.trim());
          }
          const categoria = row[7];
          if (categoria && categoria.trim() !== '') {
            categoriasSet.add(categoria.trim());
          }
        });
        setPnsUnicos([...pnsSet].sort());
        setCategoriasUnicas([...categoriasSet].sort());
        
      } catch (error) {
        console.error('Error al cargar valores únicos:', error);
        setError('Error al cargar las opciones de filtros');
      }
    };

    fetchUniqueValues();
  }, [serverApiUrl]);

  // Establecer fecha inicial al cargar la página (últimos 7 días)
  useEffect(() => {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    
    setFechaInicio(hace7Dias.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  }, []);

  const handleGenerarGrafica = async () => {
    if (!fechaInicio || !fechaFin) {
      setError('Por favor selecciona el rango de fechas');
      return;
    }

    if (new Date(fechaInicio) > new Date(fechaFin)) {
      setError('La fecha de inicio no puede ser mayor que la fecha fin');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        fechaInicio,
        fechaFin,
      });

      if (areaSeleccionada) params.append('area', areaSeleccionada);
      if (lineaSeleccionada) params.append('linea', lineaSeleccionada);
      if (pnSeleccionado) params.append('pn', pnSeleccionado);
      if (categoriaSeleccionada) params.append('categoria', categoriaSeleccionada);
      if (paroProgramadoSeleccionado) params.append('paroProgramado', paroProgramadoSeleccionado);

      const response = await fetch(`${serverApiUrl}/api/paros-por-estacion?${params}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener datos del servidor');
      }

      const data = await response.json();
      
      // Ordenar datos según la opción seleccionada
      let datosOrdenados = [...data];
      if (ordenSeleccionado === 'json' && estacionesOrden.length > 0) {
        // Ordenar según el orden del JSON
        datosOrdenados.sort((a, b) => {
          const indexA = estacionesOrden.indexOf(a.estacion);
          const indexB = estacionesOrden.indexOf(b.estacion);
          // Si no están en el JSON, ponerlos al final
          const posA = indexA === -1 ? 9999 : indexA;
          const posB = indexB === -1 ? 9999 : indexB;
          return posA - posB;
        });
      } else {
        // Ordenar por tiempo total (descendente) - ya viene así del backend
        datosOrdenados.sort((a, b) => b.tiempoTotal - a.tiempoTotal);
      }
      
      setChartData(datosOrdenados);
    } catch (error) {
      console.error('Error al generar gráfica:', error);
      setError('Error al cargar los datos. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiarFiltros = () => {
    setAreaSeleccionada('');
    setLineaSeleccionada('');
    setPnSeleccionado('');
    setCategoriaSeleccionada('');
    setParoProgramadoSeleccionado('');
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);
    setFechaInicio(hace7Dias.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
    setChartData([]);
    setError(null);
  };

  return (
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">Análisis de Paros por Estación</h1>
        <p className="page-subtitle">Visualización y análisis detallado de tiempos de paro por estación</p>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h2>Filtros de Búsqueda</h2>
        </div>
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="fechaInicio">Fecha Inicio:</label>
            <input
              type="date"
              id="fechaInicio"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="fechaFin">Fecha Fin:</label>
            <input
              type="date"
              id="fechaFin"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="area">Área:</label>
            <select
              id="area"
              value={areaSeleccionada}
              onChange={(e) => setAreaSeleccionada(e.target.value)}
            >
              <option value="">Todas las áreas</option>
              {areasUnicas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="linea">Línea:</label>
            <select
              id="linea"
              value={lineaSeleccionada}
              onChange={(e) => setLineaSeleccionada(e.target.value)}
            >
              <option value="">Todas las líneas</option>
              {lineasUnicas.map((linea) => (
                <option key={linea} value={linea}>
                  {linea}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="pn">PN (Opcional):</label>
            <select
              id="pn"
              value={pnSeleccionado}
              onChange={(e) => setPnSeleccionado(e.target.value)}
            >
              <option value="">Todos los PNs</option>
              {pnsUnicos.map((pn) => (
                <option key={pn} value={pn}>
                  {pn}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="categoria">Categoría:</label>
            <select
              id="categoria"
              value={categoriaSeleccionada}
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categoriasUnicas.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="paroProgramado">Paro Programado:</label>
            <select
              id="paroProgramado"
              value={paroProgramadoSeleccionado}
              onChange={(e) => setParoProgramadoSeleccionado(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="No">No</option>
              <option value="Si">Si</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="ordenamiento">Ordenar por:</label>
            <select
              id="ordenamiento"
              value={ordenSeleccionado}
              onChange={(e) => setOrdenSeleccionado(e.target.value)}
            >
              <option value="tiempo">Tiempo de paro (mayor a menor)</option>
              <option value="json">Orden de estaciones (JSON)</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleGenerarGrafica}
            disabled={loading}
          >
            {loading ? 'Generando...' : 'Generar Gráfica'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleLimpiarFiltros}
            disabled={loading}
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2>Gráfico de Paros por Estación</h2>
          </div>
          <StationStopChart data={chartData} />
          <div style={{ marginTop: '30px', padding: '20px', background: '#1b1f27', border: '1px solid #2a2f3a', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '15px', color: '#fff' }}>Resumen</h3>
            <div className="summary-cards">
              <div className="summary-card green">
                <div className="card-value">{chartData.length}</div>
                <div className="card-label">Estaciones</div>
              </div>
              <div className="summary-card blue">
                <div className="card-value">
                  {Math.floor(chartData.reduce((sum, item) => sum + item.tiempoTotal, 0) / 60)}h{' '}
                  {chartData.reduce((sum, item) => sum + item.tiempoTotal, 0) % 60}m
                </div>
                <div className="card-label">Tiempo Total</div>
              </div>
              <div className="summary-card orange">
                <div className="card-value">{chartData.reduce((sum, item) => sum + item.cantidadParos, 0)}</div>
                <div className="card-label">Total de Paros</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && chartData.length === 0 && fechaInicio && fechaFin && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p className="empty-state-message">No se encontraron datos para los filtros seleccionados. Intenta ajustar los filtros o el rango de fechas.</p>
        </div>
      )}
    </div>
  );
};

export default StationStopPage;
