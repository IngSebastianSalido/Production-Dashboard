import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const ParosBatchPage = () => {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [summary, setSummary] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    area: 'REA', // Filtro por defecto REA
    pn: '',
    shift: '',
    batchId: '',
    categoria: '',
    estacion: '',
    programado: '',
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
      area: 'REA',
      dateFrom: formatDate(firstDayOfMonth),
      dateTo: formatDate(today)
    });
  }, []);

  useEffect(() => {
    if (filters.dateFrom && filters.dateTo) {
      fetchBatchesWithStops();
    }
  }, [filters.dateFrom, filters.dateTo]);

  const fetchBatchesWithStops = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${serverApiUrl}/api/paros-por-batch`, {
        params: {
          from: filters.dateFrom,
          to: filters.dateTo
        }
      });
      
      setData(response.data.batches || []);
      setSummary(response.data.summary || null);
    } catch (err) {
      setError('Error de conexión con el servidor');
      console.error('Error fetching paros por batch:', err);
    } finally {
      setLoading(false);
    }
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
    return data.filter(batch => {
      // Filtro por Área
      if (filters.area && !batch.pn.toLowerCase().includes(filters.area.toLowerCase())) return false;
      
      // Filtro por PN (receta)
      if (filters.pn && !batch.pn.toLowerCase().includes(filters.pn.toLowerCase())) return false;
      
      // Filtro por Turno
      if (filters.shift) {
        const shiftNum = getShiftNumber(batch.batchId).replace('Turno ', '');
        if (shiftNum !== filters.shift) return false;
      }
      
      // Filtro por Batch ID
      if (filters.batchId && !batch.batchId.toLowerCase().includes(filters.batchId.toLowerCase())) return false;
      
      // Filtro por categoría (al menos un paro debe tener esta categoría)
      if (filters.categoria) {
        const hasCategoria = batch.paros.some(paro => 
          paro.categoria.toLowerCase().includes(filters.categoria.toLowerCase())
        );
        if (!hasCategoria) return false;
      }
      
      // Filtro por estación
      if (filters.estacion) {
        const hasEstacion = batch.paros.some(paro => 
          paro.estacion.toLowerCase().includes(filters.estacion.toLowerCase())
        );
        if (!hasEstacion) return false;
      }
      
      // Filtro por programado
      if (filters.programado) {
        if (filters.programado === 'si') {
          // Mostrar solo batches que tengan paros programados
          if (batch.totalParosProgramadosMinutos === 0) return false;
        } else if (filters.programado === 'no') {
          // Mostrar solo batches que tengan paros NO programados
          if (batch.totalParosNoProgramadosMinutos === 0) return false;
        }
      }
      
      return true;
    });
  };

  const filteredData = getFilteredData();

  // Calculate totals
  const calculateTotals = () => {
    if (filteredData.length === 0) return null;
    
    const totals = filteredData.reduce((acc, batch) => {
      return {
        totalParos: acc.totalParos + batch.totalParos,
        totalParosMinutos: acc.totalParosMinutos + batch.totalParosMinutos,
        totalParosProgramados: acc.totalParosProgramados + batch.totalParosProgramados,
        totalParosProgramadosMinutos: acc.totalParosProgramadosMinutos + batch.totalParosProgramadosMinutos,
        totalParosNoProgramados: acc.totalParosNoProgramados + batch.totalParosNoProgramados,
        totalParosNoProgramadosMinutos: acc.totalParosNoProgramadosMinutos + batch.totalParosNoProgramadosMinutos
      };
    }, { 
      totalParos: 0, 
      totalParosMinutos: 0,
      totalParosProgramados: 0,
      totalParosProgramadosMinutos: 0,
      totalParosNoProgramados: 0,
      totalParosNoProgramadosMinutos: 0
    });

    return {
      ...totals,
      promedioParosPorBatch: (totals.totalParos / filteredData.length).toFixed(2),
      promedioMinutosPorBatch: (totals.totalParosMinutos / filteredData.length).toFixed(2)
    };
  };

  const totals = calculateTotals();

  // Export to Excel (solo Paros Batch)
  const exportToExcel = () => {
    const exportData = [];
    
    filteredData.forEach(batch => {
      const startDate = new Date(batch.startISO);
      const endDate = new Date(batch.endISO);
      
      // Fila resumen del batch
      exportData.push({
        'Tipo': 'BATCH',
        'Batch ID': batch.batchId,
        'Turno': getShiftNumber(batch.batchId),
        'Día': getDayOfWeek(startDate),
        'Fecha Inicio': startDate.toLocaleDateString(),
        'Hora Inicio': startDate.toLocaleTimeString(),
        'Fecha Fin': endDate.toLocaleDateString(),
        'Hora Fin': endDate.toLocaleTimeString(),
        'PN': batch.pn,
        'Piezas Totales': batch.piezasTotales,
        'Duración (min)': batch.durationMinutes,
        'Total Paros': batch.totalParos,
        'Total Paros (min)': batch.totalParosMinutos,
        'Paros Programados': batch.totalParosProgramados,
        'Paros Programados (min)': batch.totalParosProgramadosMinutos,
        'Paros No Programados': batch.totalParosNoProgramados,
        'Paros No Programados (min)': batch.totalParosNoProgramadosMinutos,
        'Fecha Paro': '',
        'Hora Paro': '',
        'Hora Arranque': '',
        'Duración Paro (min)': '',
        'Categoría': '',
        'Estación': '',
        'Modo Falla': '',
        'Descripción Modo Falla': '',
        'Descripción': '',
        'Paro Programado': '',
        'Ajuste Proceso': ''
      });
      
      // Filas de paros individuales
      batch.paros.forEach(paro => {
        exportData.push({
          'Tipo': 'PARO',
          'Batch ID': batch.batchId,
          'Turno': getShiftNumber(batch.batchId),
          'Día': '',
          'Fecha Inicio': '',
          'Hora Inicio': '',
          'Fecha Fin': '',
          'Hora Fin': '',
          'PN': paro.pn,
          'Piezas Totales': '',
          'Duración (min)': '',
          'Total Paros': '',
          'Total Paros (min)': '',
          'Paros Programados': '',
          'Paros Programados (min)': '',
          'Paros No Programados': '',
          'Paros No Programados (min)': '',
          'Fecha Paro': paro.fecha,
          'Hora Paro': paro.hora_paro,
          'Hora Arranque': paro.hora_arranque,
          'Duración Paro (min)': paro.diferencia_minutos,
          'Categoría': paro.categoria,
          'Estación': paro.estacion,
          'Modo Falla': paro.modo_falla,
          'Descripción Modo Falla': paro.descripcion_modo_falla,
          'Descripción': paro.descripcion,
          'Paro Programado': paro.paro_programado,
          'Ajuste Proceso': paro.ajuste_proceso
        });
      });
      
      // Línea en blanco entre batches
      exportData.push({});
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paros por Batch');
    XLSX.writeFile(wb, `Paros_Batch_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export OEE + Paros Batch combinados
  const exportCombinedExcel = async () => {
    try {
      setLoading(true);
      
      // 1. Obtener datos de OEE
      const defaultRate = 180;
      const oeeResponse = await axios.get(`${serverApiUrl}/api/rea-production-eolo-cuts-oee`, {
        params: {
          from: filters.dateFrom,
          to: filters.dateTo,
          ratePerHour: defaultRate
        }
      });

      const oeeCuts = oeeResponse.data.cuts || [];

      // 2. Preparar datos para hoja OEE
      const oeeExportData = oeeCuts.map(cut => {
        const startDate = new Date(cut.startISO);
        const endDate = new Date(cut.endISO);
        
        // Calcular métricas OEE
        const disponibilidad = Number((cut.disponibilidad * 100).toFixed(2));
        const calidad = cut.calidad !== null ? Number((cut.calidad * 100).toFixed(2)) : 0;
        const eficiencia = Number((cut.eficiencia * 100).toFixed(2));
        const oee = Number(((cut.disponibilidad * (cut.calidad || 0) * cut.eficiencia) * 100).toFixed(2));
        
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
          'Tiempo de Turno (min)': cut.shiftTimeMinutes || 0,
          'Tiempo Planeado (min)': cut.tiempoPlaneadoMinutes || 0,
          'DT Programado (min)': cut.downtimeProgramadoMinutes || 0,
          'DT No Programado (min)': cut.downtimeNoProgramadoMinutes || 0,
          'Downtime Total (min)': cut.downtimeMinutes,
          'Change Over': cut.changeOver || 'No',
          'Disponibilidad %': disponibilidad,
          'OK EOL': cut.eolOk,
          'NOK EOL': cut.eolNok,
          'Calidad %': calidad,
          'RATE': defaultRate,
          'Eficiencia %': eficiencia,
          'OEE %': oee
        };
      });

      // 3. Preparar datos para hoja Paros Batch
      const parosBatchExportData = [];
      filteredData.forEach(batch => {
        const startDate = new Date(batch.startISO);
        const endDate = new Date(batch.endISO);
        
        // Fila resumen del batch
        parosBatchExportData.push({
          'Tipo': 'BATCH',
          'Batch ID': batch.batchId,
          'Turno': getShiftNumber(batch.batchId),
          'Día': getDayOfWeek(startDate),
          'Fecha Inicio': startDate.toLocaleDateString(),
          'Hora Inicio': startDate.toLocaleTimeString(),
          'Fecha Fin': endDate.toLocaleDateString(),
          'Hora Fin': endDate.toLocaleTimeString(),
          'PN': batch.pn,
          'Piezas Totales': batch.piezasTotales,
          'Duración (min)': batch.durationMinutes,
          'Total Paros': batch.totalParos,
          'Total Paros (min)': batch.totalParosMinutos,
          'Paros Programados': batch.totalParosProgramados,
          'Paros Programados (min)': batch.totalParosProgramadosMinutos,
          'Paros No Programados': batch.totalParosNoProgramados,
          'Paros No Programados (min)': batch.totalParosNoProgramadosMinutos,
          'Fecha Paro': '',
          'Hora Paro': '',
          'Hora Arranque': '',
          'Duración Paro (min)': '',
          'Categoría': '',
          'Estación': '',
          'Modo Falla': '',
          'Descripción Modo Falla': '',
          'Descripción': '',
          'Paro Programado': '',
          'Ajuste Proceso': ''
        });
        
        // Filas de paros individuales
        batch.paros.forEach(paro => {
          parosBatchExportData.push({
            'Tipo': 'PARO',
            'Batch ID': batch.batchId,
            'Turno': getShiftNumber(batch.batchId),
            'Día': '',
            'Fecha Inicio': '',
            'Hora Inicio': '',
            'Fecha Fin': '',
            'Hora Fin': '',
            'PN': paro.pn,
            'Piezas Totales': '',
            'Duración (min)': '',
            'Total Paros': '',
            'Total Paros (min)': '',
            'Paros Programados': '',
            'Paros Programados (min)': '',
            'Paros No Programados': '',
            'Paros No Programados (min)': '',
            'Fecha Paro': paro.fecha,
            'Hora Paro': paro.hora_paro,
            'Hora Arranque': paro.hora_arranque,
            'Duración Paro (min)': paro.diferencia_minutos,
            'Categoría': paro.categoria,
            'Estación': paro.estacion,
            'Modo Falla': paro.modo_falla,
            'Descripción Modo Falla': paro.descripcion_modo_falla,
            'Descripción': paro.descripcion,
            'Paro Programado': paro.paro_programado,
            'Ajuste Proceso': paro.ajuste_proceso
          });
        });
        
        // Línea en blanco entre batches
        parosBatchExportData.push({});
      });

      // 4. Crear libro de Excel con ambas hojas
      const wb = XLSX.utils.book_new();
      
      // Hoja 1: OEE
      const wsOEE = XLSX.utils.json_to_sheet(oeeExportData);
      const columnWidthsOEE = [
        { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
        { wch: 8 }, { wch: 12 }, { wch: 8 }
      ];
      wsOEE['!cols'] = columnWidthsOEE;
      XLSX.utils.book_append_sheet(wb, wsOEE, 'OEE Report');
      
      // Hoja 2: Paros Batch
      const wsParos = XLSX.utils.json_to_sheet(parosBatchExportData);
      XLSX.utils.book_append_sheet(wb, wsParos, 'Paros por Batch');
      
      // 5. Descargar archivo
      XLSX.writeFile(wb, `OEE_ParosBatch_Combined_${new Date().toISOString().split('T')[0]}.xlsx`);
      
    } catch (err) {
      console.error('Error al generar Excel combinado:', err);
      alert('Error al generar el archivo Excel combinado');
    } finally {
      setLoading(false);
    }
  };

  // Helper para exportar
  const handleExport = () => {
    exportToExcel();
  };

  // Helper para exportar combinado
  const handleCombinedExport = () => {
    exportCombinedExcel();
  };

  // Toggle expandir/colapsar detalles de paros
  const toggleBatchExpansion = (batchId) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId);
  };

  return (
    <div style={styles.container}>
      <h2 style={{color: '#fff', marginBottom: '20px'}}>🛑 Paros por Batch ID</h2>
      
      <button 
        onClick={() => setShowNotes(!showNotes)}
        style={{...styles.btn, marginBottom: '15px', background: '#424242'}}
      >
        {showNotes ? '🔼 Ocultar' : '🔽 Mostrar'} Información
      </button>

      {showNotes && (
        <div style={styles.notesContainer}>
          <h3 style={{marginTop: 0}}>📝 Acerca de esta página</h3>
          <div style={styles.noteSection}>
            <h4>🎯 Objetivo</h4>
            <p>Esta página muestra todos los paros asociados a cada batch ID de producción. 
            Los paros se asocian a un batch si ocurren dentro del rango de tiempo del batch.</p>
          </div>
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
          </div>
          <div style={styles.noteSection}>
            <h4>📊 Métricas</h4>
            <ul>
              <li><strong>Total Paros:</strong> Cantidad de paros registrados durante el batch</li>
              <li><strong>Total Paros (min):</strong> Duración total de todos los paros</li>
              <li><strong>Paros Programados:</strong> Paros planificados (mantenimiento preventivo, etc.)</li>
              <li><strong>Paros No Programados:</strong> Paros no planificados (fallas, averías, etc.)</li>
            </ul>
          </div>
          <div style={styles.noteSection}>
            <h4>🔍 Funcionalidad</h4>
            <ul>
              <li>Haz clic en una fila para expandir/colapsar el detalle de los paros</li>
              <li>Usa los filtros para encontrar batches específicos</li>
              <li>Exporta los datos a Excel para análisis adicional</li>
            </ul>
          </div>
        </div>
      )}

      <div style={styles.controlsSection}>
        <button onClick={fetchBatchesWithStops} disabled={loading} style={styles.btn}>
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
        <button onClick={handleExport} disabled={filteredData.length === 0} style={{...styles.btn, background: '#2e7d32'}}>
          📊 Exportar Paros Batch
        </button>
        <button onClick={handleCombinedExport} disabled={filteredData.length === 0 || loading} style={{...styles.btn, background: '#7b1fa2'}}>
          📑 Exportar OEE + Paros Batch
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.filtersSection}>
        <h3 style={{marginTop: 0}}>Filtros</h3>
        <div style={styles.filtersGrid}>
          <div style={styles.filterItem}>
            <label style={styles.label}>Área:</label>
            <input
              type="text"
              value={filters.area}
              onChange={(e) => setFilters({ ...filters, area: e.target.value })}
              placeholder="Buscar por área..."
              style={styles.input}
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Batch ID:</label>
            <input
              type="text"
              value={filters.batchId}
              onChange={(e) => setFilters({ ...filters, batchId: e.target.value })}
              placeholder="Buscar por Batch ID..."
              style={styles.input}
            />
          </div>
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
            <label style={styles.label}>Categoría:</label>
            <input
              type="text"
              value={filters.categoria}
              onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
              placeholder="Buscar por categoría..."
              style={styles.input}
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Estación:</label>
            <input
              type="text"
              value={filters.estacion}
              onChange={(e) => setFilters({ ...filters, estacion: e.target.value })}
              placeholder="Buscar por estación..."
              style={styles.input}
            />
          </div>
          <div style={styles.filterItem}>
            <label style={styles.label}>Tipo de Paro:</label>
            <select
              value={filters.programado}
              onChange={(e) => setFilters({ ...filters, programado: e.target.value })}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="si">Programados</option>
              <option value="no">No Programados</option>
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
                  area: 'REA',
                  pn: '', 
                  shift: '', 
                  batchId: '',
                  categoria: '',
                  estacion: '',
                  programado: '',
                  dateFrom: formatDate(firstDayOfMonth), 
                  dateTo: formatDate(today)
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
          <div style={{...styles.card, background: '#d32f2f'}}>
            <h4>Total Paros (minutos)</h4>
            <p style={styles.cardValue}>{Math.round(totals.totalParosMinutos)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.totalParosMinutos / 60).toFixed(1)} hrs</p>
          </div>
          <div style={{...styles.card, background: '#424242'}}>
            <h4>DT Programado</h4>
            <p style={styles.cardValue}>{Math.round(totals.totalParosProgramadosMinutos)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.totalParosProgramadosMinutos / 60).toFixed(1)} hrs</p>
          </div>
          <div style={{...styles.card, background: '#f57c00'}}>
            <h4>DT No Programado</h4>
            <p style={styles.cardValue}>{Math.round(totals.totalParosNoProgramadosMinutos)} min</p>
            <p style={{fontSize: '12px', color: '#ccc'}}>{(totals.totalParosNoProgramadosMinutos / 60).toFixed(1)} hrs</p>
          </div>
        </div>
      )}

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>▼</th>
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
              <th style={styles.th}>Total Paros (min)</th>
              <th style={styles.th}>DT Programado (min)</th>
              <th style={styles.th}>DT No Programado (min)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} style={styles.td}>Cargando...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={14} style={styles.td}>No hay datos disponibles. Selecciona un rango de fechas.</td></tr>
            ) : (
              filteredData.map((batch, index) => {
                const startDate = new Date(batch.startISO);
                const endDate = new Date(batch.endISO);
                const isExpanded = expandedBatch === batch.batchId;
                
                return (
                  <React.Fragment key={index}>
                    <tr 
                      style={{...styles.tr, cursor: 'pointer', background: isExpanded ? '#1b5e2033' : 'transparent'}} 
                      onClick={() => toggleBatchExpansion(batch.batchId)}
                    >
                      <td style={{...styles.td, textAlign: 'center', fontSize: '16px'}}>
                        {isExpanded ? '🔽' : '▶️'}
                      </td>
                      <td style={{...styles.td, fontFamily: 'monospace', fontSize: '11px'}}>{batch.batchId}</td>
                      <td style={{...styles.td, fontWeight: 'bold', color: '#42a5f5'}}>{getShiftNumber(batch.batchId)}</td>
                      <td style={styles.td}>{getDayOfWeek(startDate)}</td>
                      <td style={styles.td}>{batch.pn}</td>
                      <td style={styles.td}>{startDate.toLocaleDateString()}</td>
                      <td style={styles.td}>{startDate.toLocaleTimeString()}</td>
                      <td style={styles.td}>{endDate.toLocaleDateString()}</td>
                      <td style={styles.td}>{endDate.toLocaleTimeString()}</td>
                      <td style={styles.td}>{batch.piezasTotales}</td>
                      <td style={styles.td}>{batch.durationMinutes}</td>
                      <td style={styles.td}>{batch.totalParosMinutos}</td>
                      <td style={{...styles.td, background: '#42424233'}}>{batch.totalParosProgramadosMinutos}</td>
                      <td style={{...styles.td, background: '#f57c0033'}}>{batch.totalParosNoProgramadosMinutos}</td>
                    </tr>
                    {isExpanded && batch.paros.length > 0 && (
                      <tr>
                        <td colSpan={14} style={{padding: 0, background: '#0d1117'}}>
                          <div style={styles.parosDetailContainer}>
                            <h4 style={{margin: '10px 20px', color: '#42a5f5'}}>
                              📋 Detalle de Paros ({batch.paros.length})
                            </h4>
                            <table style={styles.detailTable}>
                              <thead>
                                <tr>
                                  <th style={styles.detailTh}>Fecha</th>
                                  <th style={styles.detailTh}>Hora Paro</th>
                                  <th style={styles.detailTh}>Hora Arranque</th>
                                  <th style={styles.detailTh}>Duración (min)</th>
                                  <th style={styles.detailTh}>PN</th>
                                  <th style={styles.detailTh}>Categoría</th>
                                  <th style={styles.detailTh}>Estación</th>
                                  <th style={styles.detailTh}>Modo Falla</th>
                                  <th style={styles.detailTh}>Descripción Modo Falla</th>
                                  <th style={styles.detailTh}>Descripción</th>
                                  <th style={styles.detailTh}>Programado</th>
                                  <th style={styles.detailTh}>Ajuste Proceso</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batch.paros.map((paro, paroIdx) => (
                                  <tr key={paroIdx} style={styles.detailTr}>
                                    <td style={styles.detailTd}>{paro.fecha}</td>
                                    <td style={styles.detailTd}>{paro.hora_paro}</td>
                                    <td style={styles.detailTd}>{paro.hora_arranque}</td>
                                    <td style={{...styles.detailTd, fontWeight: 'bold', color: '#f57c00'}}>
                                      {paro.diferencia_minutos}
                                    </td>
                                    <td style={styles.detailTd}>{paro.pn}</td>
                                    <td style={styles.detailTd}>{paro.categoria}</td>
                                    <td style={styles.detailTd}>{paro.estacion}</td>
                                    <td style={styles.detailTd}>{paro.modo_falla}</td>
                                    <td style={styles.detailTd}>{paro.descripcion_modo_falla}</td>
                                    <td style={styles.detailTd}>{paro.descripcion}</td>
                                    <td style={{
                                      ...styles.detailTd, 
                                      background: paro.paro_programado === 'SI' ? '#42424233' : '#f57c0033'
                                    }}>
                                      {paro.paro_programado}
                                    </td>
                                    <td style={styles.detailTd}>{paro.ajuste_proceso}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isExpanded && batch.paros.length === 0 && (
                      <tr>
                        <td colSpan={14} style={{...styles.td, background: '#0d1117', textAlign: 'center', color: '#888'}}>
                          No hay paros registrados para este batch
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
  notesContainer: {
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
  },
  parosDetailContainer: {
    padding: '10px',
    background: '#161b22'
  },
  detailTable: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '0 20px 20px 20px'
  },
  detailTh: {
    textAlign: 'left',
    padding: '8px',
    background: '#0d1117',
    color: '#888',
    fontWeight: '600',
    fontSize: '12px',
    borderBottom: '1px solid #2a2f3a'
  },
  detailTr: {
    borderBottom: '1px solid #21262d'
  },
  detailTd: {
    padding: '8px',
    color: '#ccc',
    fontSize: '12px'
  }
};

export default ParosBatchPage;
