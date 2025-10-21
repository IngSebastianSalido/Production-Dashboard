import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ReportsChart from '../components/ReportsChart';
import ReportsOEEWrapper from '../components/ReportsOEEWrapper';
import * as XLSX from 'xlsx';

const Reports = () => {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recipe, setRecipe] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [view, setView] = useState('Totals'); // Nueva opción de vista

  useEffect(() => {
    if (!from || !to) return;
    // cargar recetas disponibles en rango
    const fetchRecipes = async () => {
      try {
        const { data } = await axios.get(`${serverApiUrl}/api/reports/recipes`, {
          params: { from, to },
        });
        setRecipes(data.recipes || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchRecipes();
  }, [from, to, serverApiUrl]);

  const fetchSummary = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const resp = await axios.get(`${serverApiUrl}/api/reports/production-summary`, {
        params: { from, to, recipe: recipe || undefined },
      });
      setData(resp.data.machines || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Ejecutar fetchSummary automáticamente cuando cambian los filtros
  React.useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line
  }, [from, to, recipe]);

  // Exportar a Excel
  const handleExport = async () => {
    const wb = XLSX.utils.book_new();

    // Pestaña 1: Totales generales -> siempre usar la agregación de TODAS las recetas
    let allData = data;
    try {
      const respAll = await axios.get(`${serverApiUrl}/api/reports/production-summary`, {
        params: { from, to },
      });
      allData = respAll.data?.machines || [];
    } catch (err) {
      // si falla la petición, seguimos con los datos actuales (por ejemplo si no hay conexión)
      console.error('Error obteniendo datos generales para Excel:', err);
      allData = data;
    }

    const totalOk = allData.reduce((sum, d) => sum + (d.ok || 0), 0);
    const totalNok = allData.reduce((sum, d) => sum + (d.nok || 0), 0);
    const total = totalOk + totalNok;
    const scrapPercentage = total > 0 ? ((totalNok / total) * 100).toFixed(2) : 0;

    const generalTotals = [
      ['Filtro', 'Valor'],
      ['Desde', from],
      ['Hasta', to],
      ['Receta', 'Todas'],
      [],
      ['Máquina', 'OK', 'NOK', 'Total', 'Scrap %'],
      ...allData.map(d => [d.machine, d.ok, d.nok, (d.ok || 0) + (d.nok || 0), ((d.ok + d.nok) > 0 ? (d.nok / (d.ok + d.nok)) * 100 : 0).toFixed(2)])
    ];

    const wsGeneral = XLSX.utils.aoa_to_sheet(generalTotals);
  XLSX.utils.book_append_sheet(wb, wsGeneral, 'Totales Generales');

    // Helper: generate valid and unique sheet names (<=31 chars, no invalid chars)
    const usedSheetNames = new Set(['Totales Generales']);
    const makeSheetName = (raw) => {
      const invalid = /[\\\/?*:[\]]/g; // Excel invalid chars: \ / ? * : [ ]
      let base = String(raw)
        .replace(invalid, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!base) base = 'Sheet';
      const MAX = 31;
      if (base.length > MAX) base = base.slice(0, MAX);
      let name = base;
      let i = 1;
      while (usedSheetNames.has(name)) {
        i += 1; // start from (2)
        const suffix = ` (${i})`;
        const allowed = MAX - suffix.length;
        name = (base.length > allowed ? base.slice(0, allowed) : base) + suffix;
      }
      usedSheetNames.add(name);
      return name;
    };

    // Pestañas por receta: obtener datos por receta para evitar hojas vacías
    await Promise.all(
      (recipes || []).map(async (r) => {
        try {
          const resp = await axios.get(`${serverApiUrl}/api/reports/production-summary`, {
            params: { from, to, recipe: r },
          });
          const recipeData = resp.data?.machines || [];
          const recipeTotals = [
            ['Filtro', 'Valor'],
            ['Desde', from],
            ['Hasta', to],
            ['Receta', r],
            [],
            ['Máquina', 'OK', 'NOK', 'Total', 'Scrap %'],
            ...recipeData.map(d => [d.machine, d.ok, d.nok, (d.ok || 0) + (d.nok || 0), ((d.ok + d.nok) > 0 ? (d.nok / (d.ok + d.nok)) * 100 : 0).toFixed(2)])
          ];

          const wsRecipe = XLSX.utils.aoa_to_sheet(recipeTotals);
          const sheetName = makeSheetName(`Receta ${r}`);
          XLSX.utils.book_append_sheet(wb, wsRecipe, sheetName);
        } catch (err) {
          console.error('Error obteniendo datos de receta para Excel:', r, err);
        }
      })
    );

    // Pestaña: Totales por Día (por máquina, TODAS las recetas) -> debe ser segunda pestaña
    try {
      // omitimos recipe para asegurar TODAS las recetas
      const respDays = await axios.get(`${serverApiUrl}/api/reports/production-by-day`, {
        params: { from, to },
      });
      const machineNames = respDays.data?.machines || [];
      const days = respDays.data?.days || [];

      // Construir encabezado: Fecha, then for each machine -> '<Name> OK', '<Name> NOK'
      const header = ['Fecha'];
      machineNames.forEach(name => {
        header.push(`${name} OK`);
        header.push(`${name} NOK`);
      });

      // Construir filas: para cada day tomar oks and noks arrays
      const rows = days.map(d => {
        const row = [d.date];
        const oks = d.oks || [];
        const noks = d.noks || [];
        for (let i = 0; i < machineNames.length; i++) {
          row.push(oks[i] || 0);
          row.push(noks[i] || 0);
        }
        return row;
      });

      const daysTable = [
        ['Filtro', 'Valor'],
        ['Desde', from],
        ['Hasta', to],
        ['Recetas', 'Todas'],
        [],
        header,
        ...rows
      ];

      const wsDays = XLSX.utils.aoa_to_sheet(daysTable);
      const daySheetName = makeSheetName('Totales por Día');
      XLSX.utils.book_append_sheet(wb, wsDays, daySheetName);
      // Reorder sheets to ensure Totales Generales first and Totales por Día second
      if (wb.SheetNames && Array.isArray(wb.SheetNames)) {
        const idx = wb.SheetNames.indexOf(daySheetName);
        if (idx > 1) {
          wb.SheetNames.splice(idx, 1);
          wb.SheetNames.splice(1, 0, daySheetName);
        }
      }
    } catch (err) {
      console.error('Error obteniendo totales por día para Excel:', err);
    }

    XLSX.writeFile(wb, 'ReporteProduccionCompleto.xlsx');
  };

  // Descargar copia del ProductionReport.csv actual
  const handleDownloadProductionCsv = async () => {
    try {
      const resp = await axios.get(`${serverApiUrl}/api/reports/download-production-csv`, {
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      // intentar extraer filename desde headers
      const disposition = resp.headers['content-disposition'];
      let filename = 'ProductionReport_Copy.csv';
      if (disposition) {
        const match = disposition.match(/filename\*?=([^;]+)/);
        if (match) filename = decodeURIComponent(match[1].replace(/['"\\]/g, '')).trim();
      }
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error descargando ProductionReport:', err);
      alert('Error descargando ProductionReport. Revisa la consola.');
    }
  };

  return (
    <div className="page-container">
      <h1>Reports</h1>
      <div style={styles.filters}>
        <div style={styles.filterItem}>
          <label style={styles.label}>Desde:</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.filterItem}>
          <label style={styles.label}>Hasta:</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={styles.input} />
        </div>
        <div style={styles.filterItem}>
          <label style={styles.label}>Receta (opcional):</label>
          <select value={recipe} onChange={e => setRecipe(e.target.value)} style={styles.select}>
            <option value="">Todas</option>
            {recipes.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterItem}>
          <label style={styles.label}>Vista:</label>
          <select value={view} onChange={e => setView(e.target.value)} style={styles.select}>
            <option>Totals</option>
            <option>Scrap Percentage</option>
            <option>OEE</option>
            </select>
        </div>
      </div>

      {/* Botones: descargar siempre disponible; exportar solo si hay datos */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={handleDownloadProductionCsv} style={{...styles.exportBtn, background: '#1565c0', marginLeft: 8}}>Descargar ProductionReport</button>
        {data.length > 0 && (
          <button onClick={handleExport} style={styles.exportBtn}>Exportar Excel</button>
        )}
      </div>

      {view === 'OEE' ? (
        <div style={styles.card}>
          <ReportsOEEWrapper from={from} to={to} recipe={recipe} data={data} recipes={recipes} />
        </div>
      ) : data.length > 0 ? (
        <div style={styles.card}>
          <ReportsChart data={data} view={view} />
        </div>
      ) : (
        <p>Selecciona rango y filtros para ver el reporte.</p>
      )}
    </div>
  );
};

const styles = {
  filters: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-end',
    marginBottom: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 160,
    marginBottom: 8,
  },
  label: {
    marginBottom: 6,
    fontWeight: 500,
    color: '#eee',
    fontSize: 15,
  },
  input: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#222',
    color: '#fff',
    fontSize: 15,
  },
  select: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #444',
    background: '#222',
    color: '#fff',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 8,
  },
  exportBtn: {
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 18px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    marginRight: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'background 0.2s',
  },
};

export default Reports;
