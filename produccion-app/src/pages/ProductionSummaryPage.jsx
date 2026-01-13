import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './ProductionSummaryPage.css';

const ProductionSummaryPage = () => {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'batchId', direction: 'asc' });
  const [filters, setFilters] = useState({
    pn: '',
    shift: '',
    weekday: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${serverApiUrl}/api/production-summary`);
      if (response.data.success) {
        setData(response.data.data || []);
      } else {
        setError('Error al cargar los datos');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error('Error fetching production summary:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ordenar datos
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Aplicar filtros y ordenamiento
  const getFilteredAndSortedData = () => {
    let filtered = [...data];

    // Aplicar filtros
    if (filters.pn) {
      filtered = filtered.filter(item => 
        item.pn.toLowerCase().includes(filters.pn.toLowerCase())
      );
    }
    if (filters.shift) {
      filtered = filtered.filter(item => item.shift === filters.shift);
    }
    if (filters.weekday) {
      filtered = filtered.filter(item => item.weekday === filters.weekday);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter(item => item.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(item => item.date <= filters.dateTo);
    }

    // Aplicar ordenamiento
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Convertir a números si es necesario
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Comparación de strings
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  // Exportar a Excel
  const handleExport = () => {
    const filteredData = getFilteredAndSortedData();
    const exportData = filteredData.map(item => ({
      'Batch ID': item.batchId,
      'PN': item.pn,
      'Fecha': item.date,
      'Hora Inicio': item.startTime ? new Date(item.startTime).toLocaleTimeString() : 'N/A',
      'Hora Fin': item.endTime ? new Date(item.endTime).toLocaleTimeString() : 'N/A',
      'Día': item.weekday,
      'Semana': item.week,
      'Turno': item.shift,
      'Tiempo Producción (min)': item.productionTime,
      'Tiempo Programado (min)': item.scheduleTime,
      'Paro Programado (min)': item.downtimeScheduled,
      'Paro No Programado (min)': item.downtimeNotScheduled,
      'Piezas Producidas': item.partsProduced
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen Producción');
    XLSX.writeFile(wb, `Resumen_Produccion_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredData = getFilteredAndSortedData();

  // Calcular totales
  const totals = filteredData.reduce((acc, item) => ({
    partsProduced: acc.partsProduced + item.partsProduced,
    downtimeScheduled: acc.downtimeScheduled + item.downtimeScheduled,
    downtimeNotScheduled: acc.downtimeNotScheduled + item.downtimeNotScheduled,
    productionTime: acc.productionTime + item.productionTime,
    scheduleTime: acc.scheduleTime + item.scheduleTime
  }), {
    partsProduced: 0,
    downtimeScheduled: 0,
    downtimeNotScheduled: 0,
    productionTime: 0,
    scheduleTime: 0
  });

  // Obtener valores únicos para filtros
  const uniqueShifts = [...new Set(data.map(item => item.shift))].sort();
  const uniqueWeekdays = [...new Set(data.map(item => item.weekday))];

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="production-summary-container">
      <h1>Resumen Final de Producción</h1>

      <div className="controls-section">
        <button onClick={fetchSummary} disabled={loading} className="refresh-btn">
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
        <button onClick={handleExport} disabled={filteredData.length === 0} className="export-btn">
          📊 Exportar a Excel
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-section">
        <h3>Filtros</h3>
        <div className="filters-grid">
          <div className="filter-item">
            <label>PN:</label>
            <input
              type="text"
              value={filters.pn}
              onChange={(e) => setFilters({ ...filters, pn: e.target.value })}
              placeholder="Buscar por PN..."
            />
          </div>
          <div className="filter-item">
            <label>Turno:</label>
            <select value={filters.shift} onChange={(e) => setFilters({ ...filters, shift: e.target.value })}>
              <option value="">Todos</option>
              {uniqueShifts.map(shift => (
                <option key={shift} value={shift}>{shift}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Día:</label>
            <select value={filters.weekday} onChange={(e) => setFilters({ ...filters, weekday: e.target.value })}>
              <option value="">Todos</option>
              {uniqueWeekdays.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Desde:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="filter-item">
            <label>Hasta:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="filter-item">
            <button 
              onClick={() => setFilters({ pn: '', shift: '', weekday: '', dateFrom: '', dateTo: '' })}
              className="clear-filters-btn"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <h4>Total de Batches</h4>
          <p className="card-value">{filteredData.length}</p>
        </div>
        <div className="summary-card">
          <h4>Piezas Totales</h4>
          <p className="card-value">{totals.partsProduced.toLocaleString()}</p>
        </div>
        <div className="summary-card">
          <h4>Paro Programado</h4>
          <p className="card-value">{totals.downtimeScheduled.toFixed(0)} min</p>
        </div>
        <div className="summary-card">
          <h4>Paro No Programado</h4>
          <p className="card-value">{totals.downtimeNotScheduled.toFixed(0)} min</p>
        </div>
      </div>

      <div className="table-container">
        <table className="production-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('batchId')}>
                Batch ID {getSortIcon('batchId')}
              </th>
              <th onClick={() => handleSort('pn')}>
                PN {getSortIcon('pn')}
              </th>
              <th onClick={() => handleSort('date')}>
                Fecha {getSortIcon('date')}
              </th>
              <th onClick={() => handleSort('startTime')}>
                Hora Inicio {getSortIcon('startTime')}
              </th>
              <th onClick={() => handleSort('endTime')}>
                Hora Fin {getSortIcon('endTime')}
              </th>
              <th onClick={() => handleSort('weekday')}>
                Día {getSortIcon('weekday')}
              </th>
              <th onClick={() => handleSort('week')}>
                Semana {getSortIcon('week')}
              </th>
              <th onClick={() => handleSort('shift')}>
                Turno {getSortIcon('shift')}
              </th>
              <th onClick={() => handleSort('productionTime')}>
                Tiempo Prod. (min) {getSortIcon('productionTime')}
              </th>
              <th onClick={() => handleSort('scheduleTime')}>
                Tiempo Prog. (min) {getSortIcon('scheduleTime')}
              </th>
              <th onClick={() => handleSort('downtimeScheduled')}>
                Paro Prog. (min) {getSortIcon('downtimeScheduled')}
              </th>
              <th onClick={() => handleSort('downtimeNotScheduled')}>
                Paro No Prog. (min) {getSortIcon('downtimeNotScheduled')}
              </th>
              <th onClick={() => handleSort('partsProduced')}>
                Piezas Producidas {getSortIcon('partsProduced')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px' }}>
                  Cargando datos...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px' }}>
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              filteredData.map(item => (
                <tr key={`${item.batchId}-${item.date}-${item.pn}`}>
                  <td>{item.batchId}</td>
                  <td className="pn-cell">{item.pn}</td>
                  <td>{item.date}</td>
                  <td className="time-cell">
                    {item.startTime ? new Date(item.startTime).toLocaleTimeString('es-MX', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'N/A'}
                  </td>
                  <td className="time-cell">
                    {item.endTime ? new Date(item.endTime).toLocaleTimeString('es-MX', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'N/A'}
                  </td>
                  <td>{item.weekday}</td>
                  <td>{item.week}</td>
                  <td>{item.shift}</td>
                  <td>{item.productionTime}</td>
                  <td>{item.scheduleTime}</td>
                  <td className="downtime-scheduled">{item.downtimeScheduled.toFixed(0)}</td>
                  <td className="downtime-not-scheduled">{item.downtimeNotScheduled.toFixed(0)}</td>
                  <td className="parts-produced">{item.partsProduced.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductionSummaryPage;
