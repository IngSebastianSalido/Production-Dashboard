import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const OEEPage = () => {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [defaultRate, setDefaultRate] = useState(180); // RATE por defecto
  const [showNotes, setShowNotes] = useState(false);
  const [oeeAverages, setOeeAverages] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    pn: '',
    shift: '',
    changeOver: '',
    rework: '',
    dateFrom: '',
    dateTo: ''
  });

  // Set default dates to current month (first day to today)
  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setFilters({
      ...filters,
      dateFrom: formatDate(firstDayOfMonth),
      dateTo: formatDate(today)
    });
  }, []);

  useEffect(() => {
    if (filters.dateFrom && filters.dateTo) {
      fetchBatches();
    }
  }, [filters.dateFrom, filters.dateTo]);

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      // Usar el mismo endpoint que Reports para obtener cortes de EOL
      const response = await axios.get(`${serverApiUrl}/api/rea-production-eolo-cuts-oee`, {
        params: {
          from: filters.dateFrom,
          to: filters.dateTo,
          ratePerHour: defaultRate
        }
      });
      
      // response.data.cuts contiene los cortes con métricas OEE ya calculadas
      setData(response.data.cuts || []);
      setOeeAverages(response.data.summary || null);
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error('Error fetching OEE cuts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Las métricas OEE ya vienen calculadas del backend
  const getOEEMetrics = (cut) => {
    return {
      disponibilidad: Number((cut.disponibilidad * 100).toFixed(2)),
      calidad: cut.calidad !== null ? Number((cut.calidad * 100).toFixed(2)) : 0,
      eficiencia: Number((cut.eficiencia * 100).toFixed(2)),
      oee: Number(((cut.disponibilidad * (cut.calidad || 0) * cut.eficiencia) * 100).toFixed(2)),
      // Nuevos campos de disponibilidad
      shiftTimeMinutes: cut.shiftTimeMinutes || 0,
      tiempoPlaneadoMinutes: cut.tiempoPlaneadoMinutes || 0,
      downtimeProgramadoMinutes: cut.downtimeProgramadoMinutes || 0,
      downtimeNoProgramadoMinutes: cut.downtimeNoProgramadoMinutes || 0
    };
  };

  // Función para obtener día de la semana en español
  const getDayOfWeek = (date) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  };

  // Función para extraer número de turno del Batch ID
  const getShiftNumber = (batchId) => {
    if (!batchId) return '';
    const match = batchId.match(/S(\d)/);
    return match ? `Turno ${match[1]}` : '';
  };

  // Apply filters
  const getFilteredData = () => {
    return data.filter(cut => {
      // Filtro por PN (receta)
      if (filters.pn && !cut.pn.toLowerCase().includes(filters.pn.toLowerCase())) return false;
      
      // Filtro por Turno
      if (filters.shift) {
        const shiftNum = getShiftNumber(cut.batchId).replace('Turno ', '');
        if (shiftNum !== filters.shift) return false;
      }
      
      // Filtro por Change Over
      if (filters.changeOver) {
        const hasChangeOver = cut.changeOver === 'Si';
        if (filters.changeOver === 'si' && !hasChangeOver) return false;
        if (filters.changeOver === 'no' && hasChangeOver) return false;
      }
      
      // Filtro por Rework
      if (filters.rework) {
        const isRework = cut.pn.toLowerCase().includes('rework');
        if (filters.rework === 'si' && !isRework) return false;
        if (filters.rework === 'no' && isRework) return false;
      }
      
      return true;
    });
  };

  const filteredData = getFilteredData();

  // Calculate totals and averages usando los promedios del backend
  const calculateTotals = () => {
    if (filteredData.length === 0) return null;
    
    const totals = filteredData.reduce((acc, cut) => {
      return {
        eolOk: acc.eolOk + (cut.eolOk || 0),
        eolNok: acc.eolNok + (cut.eolNok || 0),
        downtimeMinutes: acc.downtimeMinutes + (cut.downtimeMinutes || 0),
        piezasTotales: acc.piezasTotales + (cut.piezasTotales || 0),
        shiftTimeMinutes: acc.shiftTimeMinutes + (cut.shiftTimeMinutes || 0),
        tiempoPlaneadoMinutes: acc.tiempoPlaneadoMinutes + (cut.tiempoPlaneadoMinutes || 0),
        downtimeProgramadoMinutes: acc.downtimeProgramadoMinutes + (cut.downtimeProgramadoMinutes || 0),
        downtimeNoProgramadoMinutes: acc.downtimeNoProgramadoMinutes + (cut.downtimeNoProgramadoMinutes || 0)
      };
    }, { 
      eolOk: 0, 
      eolNok: 0, 
      downtimeMinutes: 0, 
      piezasTotales: 0,
      shiftTimeMinutes: 0,
      tiempoPlaneadoMinutes: 0,
      downtimeProgramadoMinutes: 0,
      downtimeNoProgramadoMinutes: 0
    });

    // Usar los promedios calculados por el backend si están disponibles
    const disponibilidadAvg = oeeAverages?.disponibilidadAvg !== null 
      ? Number((oeeAverages.disponibilidadAvg * 100).toFixed(2))
      : 0;
    const calidadAvg = oeeAverages?.calidadAvg !== null
      ? Number((oeeAverages.calidadAvg * 100).toFixed(2))
      : 0;
    const eficienciaAvg = oeeAverages?.eficienciaAvg !== null
      ? Number((oeeAverages.eficienciaAvg * 100).toFixed(2))
      : 0;
    
    return {
      disponibilidadAvg,
      calidadAvg,
      eficienciaAvg,
      oeeAvg: Number(((disponibilidadAvg * calidadAvg * eficienciaAvg) / 10000).toFixed(2)),
      eolOk: totals.eolOk,
      eolNok: totals.eolNok,
      shiftTimeMinutes: totals.shiftTimeMinutes,
      tiempoPlaneadoMinutes: totals.tiempoPlaneadoMinutes,
      downtimeProgramadoMinutes: totals.downtimeProgramadoMinutes,
      downtimeNoProgramadoMinutes: totals.downtimeNoProgramadoMinutes,
      downtimeScheduled: totals.downtimeProgramadoMinutes,
      downtimeNotScheduled: totals.downtimeNoProgramadoMinutes
    };
  };

  const totals = calculateTotals();

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredData.map(cut => {
      const metrics = getOEEMetrics(cut);
      const startDate = new Date(cut.startISO);
      const endDate = new Date(cut.endISO);
      return {
        'Batch ID': cut.batchId || 'N/A',
        'Turno': getShiftNumber(cut.batchId),
        'Día': getDayOfWeek(startDate),
        'Fecha Inicio': startDate.toLocaleDateString(),
        'Hora Inicio': startDate.toLocaleTimeString(),
        'Fecha Fin': endDate.toLocaleDateString(),
        'Hora Fin': endDate.toLocaleTimeString(),
        'PN': cut.pn,
        'Piezas Totales': cut.piezasTotales,
        'Duración (min)': cut.durationMinutes,
        'Tiempo de Turno (min)': metrics.shiftTimeMinutes,
        'Tiempo Planeado (min)': metrics.tiempoPlaneadoMinutes,
        'DT Programado (min)': metrics.downtimeProgramadoMinutes,
        'DT No Programado (min)': metrics.downtimeNoProgramadoMinutes,
        'Downtime Total (min)': cut.downtimeMinutes,
        'Change Over': cut.changeOver || 'No',
        'Disponibilidad %': metrics.disponibilidad,
        'OK EOL': cut.eolOk,
        'NOK EOL': cut.eolNok,
        'Calidad %': metrics.calidad,
        'RATE': defaultRate,
        'Eficiencia %': metrics.eficiencia,
        'OEE %': metrics.oee
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    // Ajustar ancho de columnas para mejor visualización
    const columnWidths = [
      { wch: 15 },  // Batch ID
      { wch: 10 },  // Turno
      { wch: 12 },  // Día
      { wch: 12 },  // Fecha Inicio
      { wch: 12 },  // Hora Inicio
      { wch: 12 },  // Fecha Fin
      { wch: 12 },  // Hora Fin
      { wch: 20 },  // PN
      { wch: 12 },  // Piezas Totales
      { wch: 12 },  // Duración
      { wch: 14 },  // Tiempo de Turno
      { wch: 14 },  // Tiempo Planeado
      { wch: 14 },  // DT Programado
      { wch: 14 },  // DT No Programado
      { wch: 14 },  // Downtime Total
      { wch: 12 },  // Change Over
      { wch: 14 },  // Disponibilidad
      { wch: 8 },   // OK EOL
      { wch: 8 },   // NOK EOL
      { wch: 10 },  // Calidad
      { wch: 8 },   // RATE
      { wch: 12 },  // Eficiencia
      { wch: 8 }    // OEE
    ];
    ws['!cols'] = columnWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OEE Report');
    XLSX.writeFile(wb, `OEE_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper para exportar
  const handleExport = () => {
    exportToExcel();
  };

  return (
    <div style={styles.container}>
      <h2 style={{color: '#fff', marginBottom: '20px'}}>📊 OEE (Overall Equipment Effectiveness)</h2>
      
      <button 
        onClick={() => setShowNotes(!showNotes)}
        style={{...styles.btn, marginBottom: '15px', background: '#424242'}}
      >
        {showNotes ? '🔼 Ocultar' : '🔽 Mostrar'} Información sobre el Cálculo de OEE
      </button>

      {showNotes && (
        <div style={styles.notesContainer}>
          <h3 style={{marginTop: 0}}>📝 Cómo se calculan las métricas de OEE</h3>
          <div style={styles.noteSection}>
            <h4>🔢 Batch ID</h4>
            <p><strong>Formato:</strong> D[MMDDYYYY]S[#]C[#]</p>
            <p><strong>Componentes:</strong></p>
            <ul>
              <li><strong>D:</strong> Prefijo de "Date" (Fecha)</li>
              <li><strong>MMDDYYYY:</strong> Fecha en formato Mes/Día/Año (08 dígitos)</li>
              <li><strong>S#:</strong> Número de turno (1=7AM-3PM, 2=3PM-10:30PM, 3=10:30PM-7AM)</li>
              <li><strong>C#:</strong> Número de corte dentro del turno (incrementa con cada cambio de receta)</li>
            </ul>
            <p><strong>Ejemplo:</strong> <code>D10222025S1C2</code> = 22 de octubre 2025, Turno 1, Corte 2</p>
            <p><strong>Descripción:</strong> Identificador único para cada batch de producción que combina fecha, turno y secuencia de corte. 
            Útil para rastrear y analizar batches específicos.</p>
          </div>
          <div style={styles.noteSection}>
            <h4>🟢 Disponibilidad</h4>
            <p><strong>Fórmula:</strong> (Tiempo Planeado - Downtime No Programado) / Tiempo Planeado × 100</p>
            <p><strong>Componentes:</strong></p>
            <ul>
              <li><strong>Tiempo de Turno:</strong> Duración total de los turnos involucrados (7AM-3PM: 480 min, 3PM-10:30PM: 450 min, 10:30PM-7AM: 450 min)</li>
              <li><strong>Tiempo Planeado:</strong> Tiempo de Turno - Downtime Programado</li>
              <li><strong>Downtime Programado:</strong> Paros planificados (mantenimiento preventivo, cambios programados, etc.)</li>
              <li><strong>Downtime No Programado:</strong> Paros no planificados (fallas, averías, problemas de calidad, etc.)</li>
            </ul>
            <p><strong>Descripción:</strong> Mide el porcentaje de tiempo planeado que el equipo estuvo disponible para producir, 
            excluyendo paros programados pero considerando el impacto de paros no programados.</p>
          </div>
          <div style={styles.noteSection}>
            <h4>🔵 Calidad</h4>
            <p><strong>Fórmula:</strong> OK EOL / (OK EOL + NOK EOL) × 100</p>
            <p><strong>Descripción:</strong> Representa el porcentaje de piezas que pasaron correctamente la estación EOL 
            (End of Line) sin defectos. Se basa en las piezas aprobadas vs las rechazadas en la última estación de control de calidad.</p>
          </div>
          <div style={styles.noteSection}>
            <h4>🟡 Eficiencia</h4>
            <p><strong>Fórmula:</strong> Piezas OK / (RATE × Tiempo Productivo Real / 60) × 100</p>
            <p><strong>Descripción:</strong> Compara la producción real de piezas buenas contra la producción esperada según el 
            RATE (piezas por hora). El tiempo productivo real es el tiempo programado menos los paros no programados.</p>
            <p><strong>RATE por defecto:</strong> {defaultRate} piezas/hora (editable)</p>
          </div>
          <div style={styles.noteSection}>
            <h4>🎯 OEE (Overall Equipment Effectiveness)</h4>
            <p><strong>Fórmula:</strong> Disponibilidad × Calidad × Eficiencia / 10000</p>
            <p><strong>Descripción:</strong> Es el producto de las tres métricas anteriores, representando el aprovechamiento 
            general del equipo. Un OEE de 85% o más se considera world-class manufacturing.</p>
          </div>
        </div>
      )}

      <div style={styles.controlsSection}>
        <div style={styles.rateControl}>
          <label style={styles.label}>RATE (piezas/hora):</label>
          <input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(Number(e.target.value) || 180)}
            style={styles.rateInput}
            min="1"
          />
        </div>
        <button onClick={fetchBatches} disabled={loading} style={styles.btn}>
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
        <button onClick={handleExport} disabled={filteredData.length === 0} style={{...styles.btn, background: '#2e7d32'}}>
          📊 Exportar a Excel
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.filtersSection}>
        <h3 style={{marginTop: 0}}>Filtros</h3>
        <div style={styles.filtersGrid}>
          <div style={styles.filterItem}>
            <label style={styles.label}>PN (Receta):</label>
            <input
              type="text"
              value={filters.pn}
              onChange={(e) => setFilters({ ...filters, pn: e.target.value })}
              placeholder="Buscar por PN..."
              style={styles.input}
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Turno:</label>
            <select
              value={filters.shift}
              onChange={(e) => setFilters({ ...filters, shift: e.target.value })}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="1">Turno 1 (7AM-3PM)</option>
              <option value="2">Turno 2 (3PM-10:30PM)</option>
              <option value="3">Turno 3 (10:30PM-7AM)</option>
            </select>
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Change Over:</label>
            <select
              value={filters.changeOver}
              onChange={(e) => setFilters({ ...filters, changeOver: e.target.value })}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Rework:</label>
            <select
              value={filters.rework}
              onChange={(e) => setFilters({ ...filters, rework: e.target.value })}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Desde:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Hasta:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.filterItem}>
            <button 
              onClick={() => {
                const today = new Date();
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const formatDate = (date) => {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                };
                setFilters({ 
                  pn: '', 
                  shift: '', 
                  changeOver: '', 
                  rework: '', 
                  dateFrom: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)), 
                  dateTo: formatDate(new Date())
                });
              }}
              style={styles.clearBtn}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {totals && (
        <div style={styles.summaryCards}>
          <div style={styles.card}>
            <h4>Total Cortes</h4>
            <p style={styles.cardValue}>{filteredData.length}</p>
          </div>
          <div style={{...styles.card, background: '#1b5e20'}}>
            <h4>Disponibilidad Promedio</h4>
            <p style={styles.cardValue}>{totals.disponibilidadAvg}%</p>
          </div>
          <div style={{...styles.card, background: '#0d47a1'}}>
            <h4>Calidad Promedio</h4>
            <p style={styles.cardValue}>{totals.calidadAvg}%</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>OK: {totals.eolOk} | NOK: {totals.eolNok}</p>
          </div>
          <div style={{...styles.card, background: '#f57c00'}}>
            <h4>Eficiencia Promedio</h4>
            <p style={styles.cardValue}>{totals.eficienciaAvg}%</p>
          </div>
          <div style={{...styles.card, background: '#6a1b9a'}}>
            <h4>OEE Promedio</h4>
            <p style={styles.cardValue}>{totals.oeeAvg}%</p>
          </div>
        </div>
      )}

      {totals && (
        <div style={styles.summaryCards}>
          <div style={styles.card}>
            <h4>⏱️ Tiempo de Turno Total</h4>
            <p style={styles.cardValue}>{Math.round(totals.shiftTimeMinutes)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.shiftTimeMinutes / 60).toFixed(1)} hrs</p>
          </div>
          <div style={{...styles.card, background: '#004d40'}}>
            <h4>📅 Tiempo Planeado Total</h4>
            <p style={styles.cardValue}>{Math.round(totals.tiempoPlaneadoMinutes)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.tiempoPlaneadoMinutes / 60).toFixed(1)} hrs</p>
          </div>
          <div style={{...styles.card, background: '#424242'}}>
            <h4>🔧 DT Programado Total</h4>
            <p style={styles.cardValue}>{Math.round(totals.downtimeProgramadoMinutes)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.downtimeProgramadoMinutes / 60).toFixed(1)} hrs</p>
          </div>
          <div style={{...styles.card, background: '#b71717'}}>
            <h4>⚠️ DT No Programado Total</h4>
            <p style={styles.cardValue}>{Math.round(totals.downtimeNoProgramadoMinutes)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.downtimeNoProgramadoMinutes / 60).toFixed(1)} hrs</p>
          </div>
        </div>
      )}

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Batch ID</th>
              <th style={styles.th}>Turno</th>
              <th style={styles.th}>Día</th>
              <th style={styles.th}>PN</th>
              <th style={styles.th}>Fecha Inicio</th>
              <th style={styles.th}>Hora Inicio</th>
              <th style={styles.th}>Fecha Fin</th>
              <th style={styles.th}>Hora Fin</th>
              <th style={styles.th}>Piezas Totales</th>
              <th style={styles.th}>Duración (min)</th>
              <th style={styles.th}>Tiempo Turno (min)</th>
              <th style={styles.th}>Tiempo Planeado (min)</th>
              <th style={styles.th}>DT Programado (min)</th>
              <th style={styles.th}>DT No Programado (min)</th>
              <th style={styles.th}>Downtime Total (min)</th>
              <th style={styles.th}>Change Over</th>
              <th style={styles.th}>Disponibilidad %</th>
              <th style={styles.th}>OK EOL</th>
              <th style={styles.th}>NOK EOL</th>
              <th style={styles.th}>Calidad %</th>
              <th style={styles.th}>RATE</th>
              <th style={styles.th}>Eficiencia %</th>
              <th style={styles.th}>OEE %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={23} style={styles.td}>Cargando...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={23} style={styles.td}>No hay datos disponibles. Selecciona un rango de fechas.</td></tr>
            ) : (
              filteredData.map((cut, index) => {
                const metrics = getOEEMetrics(cut);
                const startDate = new Date(cut.startISO);
                const endDate = new Date(cut.endISO);
                return (
                  <tr key={index} style={styles.tr}>
                    <td style={{...styles.td, fontFamily: 'monospace', fontSize: '11px'}}>{cut.batchId || 'N/A'}</td>
                    <td style={{...styles.td, fontWeight: 'bold', color: '#42a5f5'}}>{getShiftNumber(cut.batchId)}</td>
                    <td style={styles.td}>{getDayOfWeek(startDate)}</td>
                    <td style={styles.td}>{cut.pn}</td>
                    <td style={styles.td}>{startDate.toLocaleDateString()}</td>
                    <td style={styles.td}>{startDate.toLocaleTimeString()}</td>
                    <td style={styles.td}>{endDate.toLocaleDateString()}</td>
                    <td style={styles.td}>{endDate.toLocaleTimeString()}</td>
                    <td style={styles.td}>{cut.piezasTotales}</td>
                    <td style={styles.td}>{cut.durationMinutes}</td>
                    <td style={styles.td}>{metrics.shiftTimeMinutes}</td>
                    <td style={styles.td}>{metrics.tiempoPlaneadoMinutes}</td>
                    <td style={{...styles.td, background: '#42424233'}}>{metrics.downtimeProgramadoMinutes}</td>
                    <td style={{...styles.td, background: '#b7171733'}}>{metrics.downtimeNoProgramadoMinutes}</td>
                    <td style={styles.td}>{cut.downtimeMinutes}</td>
                    <td style={styles.td}>{cut.changeOver || 'No'}</td>
                    <td style={{...styles.td, background: metrics.disponibilidad >= 85 ? '#1b5e2033' : '#b7171733'}}>{metrics.disponibilidad}</td>
                    <td style={styles.td}>{cut.eolOk}</td>
                    <td style={styles.td}>{cut.eolNok}</td>
                    <td style={{...styles.td, background: metrics.calidad >= 95 ? '#0d47a133' : '#b7171733'}}>{metrics.calidad}</td>
                    <td style={styles.td}>{defaultRate}</td>
                    <td style={{...styles.td, background: metrics.eficiencia >= 85 ? '#f57c0033' : '#b7171733'}}>{metrics.eficiencia}</td>
                    <td style={{...styles.td, background: metrics.oee >= 85 ? '#6a1b9a33' : '#b7171733', fontWeight: 'bold'}}>{metrics.oee}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1800px',
    margin: '0 auto',
    color: '#fff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    borderBottom: '2px solid #1976d2',
    paddingBottom: '15px',
  },
  title: {
    color: '#fff',
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#aaa',
    fontSize: '14px',
    margin: 0,
  },
  noteBtn: {
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px'
  },
  notesPanel: {
    background: '#1b1f27',
    border: '1px solid #2a2f3a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    color: '#fff'
  },
  noteSection: {
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #2a2f3a'
  },
  controlsSection: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  rateControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#1b1f27',
    padding: '10px 15px',
    borderRadius: '8px',
    border: '1px solid #2a2f3a'
  },
  rateInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#222',
    color: '#fff',
    width: '100px',
    fontSize: '14px'
  },
  btn: {
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px'
  },
  error: {
    background: '#d32f2f',
    color: '#fff',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  filtersSection: {
    background: '#1b1f27',
    border: '1px solid #2a2f3a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px'
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    alignItems: 'end'
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    color: '#ddd',
    fontSize: '14px',
    fontWeight: '600'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #444',
    background: '#222',
    color: '#fff',
    fontSize: '14px'
  },
  clearBtn: {
    background: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '20px'
  },
  card: {
    background: '#1b1f27',
    border: '1px solid #2a2f3a',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center'
  },
  cardValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '10px 0 0 0',
    color: '#fff'
  },
  tableContainer: {
    overflowX: 'auto',
    background: '#1b1f27',
    borderRadius: '12px',
    border: '1px solid #2a2f3a'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '1600px'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    background: '#0d1117',
    color: '#ddd',
    fontWeight: '600',
    fontSize: '13px',
    borderBottom: '2px solid #2a2f3a',
    position: 'sticky',
    top: 0
  },
  tr: {
    borderBottom: '1px solid #2a2f3a'
  },
  td: {
    padding: '12px',
    color: '#fff',
    fontSize: '13px'
  }
};

export default OEEPage;
