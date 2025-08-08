import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ReportsChart from '../components/ReportsChart';
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

    // Pestaña 1: Totales generales
    const totalOk = data.reduce((sum, d) => sum + (d.ok || 0), 0);
    const totalNok = data.reduce((sum, d) => sum + (d.nok || 0), 0);
    const total = totalOk + totalNok;
    const scrapPercentage = total > 0 ? ((totalNok / total) * 100).toFixed(2) : 0;

    const generalTotals = [
      ['Filtro', 'Valor'],
      ['Desde', from],
      ['Hasta', to],
      ['Receta', recipe || 'Todas'],
      [],
      ['Máquina', 'OK', 'NOK', 'Total', 'Scrap %'],
      ...data.map(d => [d.machine, d.ok, d.nok, (d.ok || 0) + (d.nok || 0), ((d.ok + d.nok) > 0 ? (d.nok / (d.ok + d.nok)) * 100 : 0).toFixed(2)])
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

    XLSX.writeFile(wb, 'ReporteProduccionCompleto.xlsx');
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
          </select>
        </div>
      </div>

      {data.length > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={handleExport} style={styles.exportBtn}>Exportar Excel</button>
          </div>
          <div style={styles.card}>
            <ReportsChart data={data} view={view} />
          </div>
        </>
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
