import React, { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList,
} from 'recharts';
import './READiarioChart.css';

// ─── Colores por categoría ────────────────────────────────────────────────────
const getCategoryColor = (categoria) => {
  const c = (categoria || '').toLowerCase();
  if (c.includes('equipment') || c.includes('fallo'))           return '#e57373'; // rojo suave
  if (c.includes('quality')   || c.includes('calidad'))         return '#81c784'; // verde suave
  if (c.includes('production') || c.includes('producción'))     return '#64b5f6'; // azul suave
  if (c.includes('maintenance') || c.includes('mantenimiento')) return '#ce93d8'; // morado suave
  return '#b0bec5'; // gris
};

// ─── Etiqueta dentro de cada segmento de barra ───────────────────────────────
const SegmentLabel = ({ x, y, width, height, value, desc }) => {
  if (!value || height < 16 || width < 20) return null;
  const maxChars = Math.max(3, Math.floor(width / 6.5));
  const text = desc && desc.length > maxChars ? desc.slice(0, maxChars - 1) + '…' : (desc || '');
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#fff"
      fontSize={10}
      textAnchor="middle"
      dominantBaseline="middle"
      style={{ pointerEvents: 'none', fontWeight: 600 }}
    >
      {text}
    </text>
  );
};

// ─── Tooltip personalizado para barras ───────────────────────────────────────
const ParosTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const items = payload.filter(p => p.value > 0);
  return (
    <div style={{ background: '#1e1e1e', border: '1px solid #555', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
      <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#fff' }}>{label}</p>
      {items.map((p) => {
        const [desc, cat] = p.dataKey.split('||');
        return (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.fill, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#ddd' }}>{desc || '–'}</span>
            <strong style={{ color: '#fff', marginLeft: 8 }}>{p.value} min</strong>
          </div>
        );
      })}
      <div style={{ borderTop: '1px solid #444', marginTop: 6, paddingTop: 4, fontWeight: 700, color: '#fff' }}>
        Total: {items.reduce((s, p) => s + p.value, 0)} min
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const READiarioChart = ({ fecha }) => {
  const [tendenciaData,    setTendenciaData]    = useState([]);
  const [parosPorEstacion, setParosPorEstacion] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [pdh,              setPdh]              = useState(2.5);   // programmed downtime hours
  const [resumenDiario,    setResumenDiario]    = useState({});

  const backendUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/rea-production-diario?fecha=${fecha}&programmedDowntimeHours=${pdh}`
      );
      const result = await res.json();
      if (result.error) { console.error('Error servidor:', result.error); return; }
      setTendenciaData(result.tendencia       || []);
      setParosPorEstacion(result.parosPorEstacion || []);
      setResumenDiario(result.resumenDiario   || {});
    } catch (e) {
      console.error('Error al obtener datos REA Diario:', e);
    } finally {
      setLoading(false);
    }
  }, [fecha, pdh, backendUrl]);

  useEffect(() => { if (fecha) fetchData(); }, [fetchData]);

  // ── Preparar datos del gráfico de paros ─────────────────────────────────────
  // Clave única por (descripcion||categoria) para apilar bloques individuales
  const allSegmentKeys = Array.from(
    new Set(
      parosPorEstacion.flatMap(p =>
        p.parosAgrupados.map(pa => `${pa.descripcionModoFalla}||${pa.categoria}`)
      )
    )
  );

  // Asociar cada clave a su categoría (para el color)
  const keyToCategoria = {};
  parosPorEstacion.forEach(p =>
    p.parosAgrupados.forEach(pa => {
      keyToCategoria[`${pa.descripcionModoFalla}||${pa.categoria}`] = pa.categoria;
    })
  );

  const dataParos = parosPorEstacion.map(p => {
    const row = { estacion: p.estacion, total: p.tiempoTotal };
    allSegmentKeys.forEach(k => { row[k] = 0; });
    p.parosAgrupados.forEach(pa => {
      const k = `${pa.descripcionModoFalla}||${pa.categoria}`;
      row[k] = (row[k] || 0) + pa.minutos;
    });
    return row;
  });

  // Leyenda manual de categorías
  const categoriaColors = [
    { label: 'Equipment fault', color: '#e57373' },
    { label: 'Quality',         color: '#81c784' },
    { label: 'Production',      color: '#64b5f6' },
    { label: 'Maintenance',     color: '#ce93d8' },
  ];

  if (loading) return <p style={{ textAlign: 'center', padding: '20px', color: '#fff' }}>Cargando datos…</p>;

  const diferenciaSign = (resumenDiario.diferenciaDiaria || 0) >= 0 ? '+' : '';

  return (
    <div className="rea-diario-container">

      {/* ── Controles ─────────────────────────────────────────────────────── */}
      <div className="rea-diario-controls">
        <div className="control-group">
          <label htmlFor="pdh">Horas de Paro Programado:</label>
          <input
            id="pdh"
            type="number"
            step="0.5"
            min="0"
            max="23"
            value={pdh}
            onChange={(e) => setPdh(parseFloat(e.target.value) || 0)}
          />
          <span className="control-unit">hrs&nbsp;→&nbsp;Target: {((24 - pdh) * 180).toLocaleString()} pcs</span>
        </div>
      </div>

      {/* ── Resumen ───────────────────────────────────────────────────────── */}
      <div className="resumen-diario">
        <div className="resumen-item">
          <span className="resumen-label">Total Producido</span>
          <span className="resumen-value">{(resumenDiario.totalProducido || 0).toLocaleString()} pcs</span>
        </div>
        <div className="resumen-item">
          <span className="resumen-label">Target ({(24 - pdh)}h × 180)</span>
          <span className="resumen-value">{(resumenDiario.totalEsperado || 0).toLocaleString()} pcs</span>
        </div>
        <div className={`resumen-item ${(resumenDiario.diferenciaDiaria || 0) >= 0 ? 'positive' : 'negative'}`}>
          <span className="resumen-label">Diferencia</span>
          <span className="resumen-value">
            {diferenciaSign}{(resumenDiario.diferenciaDiaria || 0).toLocaleString()} pcs
          </span>
        </div>
      </div>

      {/* ── Gráfica Tendencia ─────────────────────────────────────────────── */}
      <div className="rea-diario-chart">
        <h2>Tendencia Acumulada — {fecha} (07:00 → +24 h)</h2>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={tendenciaData} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
              <defs>
                <style>{`
                  .recharts-text { fill: #fff !important; }
                  .recharts-cartesian-axis-tick { color: #fff !important; }
                `}</style>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="hora" tick={{ fontSize: 12, fill: '#fff', fontWeight: 600 }} />
              <YAxis yAxisId="left" tickFormatter={v => v.toLocaleString()} tick={{ fontSize: 12, fill: '#fff', fontWeight: 600 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => v.toLocaleString()} tick={{ fontSize: 12, fill: '#fff', fontWeight: 600 }} />
              <Tooltip
                formatter={(value, name) => [value.toLocaleString() + ' pcs', name]}
                contentStyle={{ fontSize: 12, background: '#1e1e1e', border: '1px solid #555', color: '#fff', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                labelStyle={{ color: '#fff', fontWeight: 700 }}
                itemStyle={{ color: '#ddd' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="acumuladaProducida"
                stroke="#3498db"
                name="Producido acumulado"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="acumuladaEsperada"
                stroke="#e67e22"
                name={`Esperado (${(24-pdh)}h × 180)`}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="diferencia"
                stroke="#27ae60"
                name="Diferencia"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="2 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Gráfica Paros por Estación ─────────────────────────────────────── */}
      {dataParos.length > 0 && (
        <div className="rea-diario-chart">
          <h2>Paros por Estación — REA</h2>

          {/* Leyenda manual de categorías */}
          <div className="categoria-legend">
            {categoriaColors.map(({ label, color }) => (
              <span key={label} className="legend-item">
                <span className="legend-swatch" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>

          <div style={{ height: Math.max(380, dataParos.length * 55 + 120) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataParos}
                margin={{ top: 10, right: 30, left: 10, bottom: 80 }}
              >
                <defs>
                  <style>{`
                    .recharts-text { fill: #fff !important; }
                    .recharts-cartesian-axis-tick { color: #fff !important; }
                  `}</style>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="estacion"
                  angle={-40}
                  textAnchor="end"
                  height={85}
                  tick={{ fontSize: 12, fill: '#fff', fontWeight: 600 }}
                />
                <YAxis
                  label={{ value: 'min', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#fff', fontWeight: 600 }}
                  tick={{ fontSize: 12, fill: '#fff', fontWeight: 600 }}
                />
                <Tooltip content={<ParosTooltip />} />
                {allSegmentKeys.map((key) => {
                  const [desc] = key.split('||');
                  const cat    = keyToCategoria[key] || '';
                  return (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="paros"
                      fill={getCategoryColor(cat)}
                      name={desc}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey={key}
                        content={(props) => <SegmentLabel {...props} desc={desc} />}
                      />
                    </Bar>
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla resumen */}
          <div className="paros-tabla">
            <table>
              <thead>
                <tr>
                  <th>Estación</th>
                  <th>Descripción Modo de Falla</th>
                  <th>Categoría</th>
                  <th>Min</th>
                </tr>
              </thead>
              <tbody>
                {parosPorEstacion.flatMap(e =>
                  e.parosAgrupados.map((pa, i) => (
                    <tr key={`${e.estacion}-${i}`}>
                      {i === 0 && (
                        <td rowSpan={e.parosAgrupados.length} className="td-estacion">
                          {e.estacion}
                          <br /><small>{e.tiempoTotal} min</small>
                        </td>
                      )}
                      <td>{pa.descripcionModoFalla || '–'}</td>
                      <td>
                        <span className="cat-badge" style={{ background: getCategoryColor(pa.categoria) }}>
                          {pa.categoria}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{pa.minutos}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && parosPorEstacion.length === 0 && (
        <div className="no-data">No hay paros de REA registrados para esta fecha</div>
      )}
    </div>
  );
};

export default READiarioChart;
