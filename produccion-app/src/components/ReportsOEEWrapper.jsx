import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Doughnut } from 'react-chartjs-2';
import { startOfDay, endOfDay, parseYYYYMMDD } from '../utils/dateUtils';

// Simple OEE wrapper component that fetches needed data and computes
// Disponibilidad, Calidad y Eficiencia. It also shows a table per "corte" (production resets)

const ReportsOEEWrapper = ({ from, to, recipe, data: summaryData, recipes }) => {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const [loading, setLoading] = useState(false);
  const [machinesSummary, setMachinesSummary] = useState([]);
  const [daysByMachine, setDaysByMachine] = useState([]);
  const [stops, setStops] = useState([]);
  const [oeeAverages, setOeeAverages] = useState(null);

  useEffect(() => {
    if (!from || !to) return;
    fetchAll();
    // eslint-disable-next-line
  }, [from, to, recipe]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryResp, cutsResp, stopsResp] = await Promise.all([
        axios.get(`${serverApiUrl}/api/reports/production-summary`, { params: { from, to, recipe: recipe || undefined } }),
        axios.get(`${serverApiUrl}/api/rea-production-eolo-cuts-oee`, { params: { from, to, recipe: recipe || undefined, ratePerHour: 154 } }),
        axios.get(`${serverApiUrl}/api/paros`),
      ]);

      setMachinesSummary(summaryResp.data.machines || []);
  // cutsResp.data.cuts -> array of enriched cuts (startISO,endISO,pn,piezasTotales,durationMinutes,downtimeMinutes,disponibilidad,eficiencia,calidad,eolOk,eolNok,stations)
  setDaysByMachine(cutsResp.data.cuts || []);
      // store backend-provided averages (fractions 0..1)
      const backendSummary = cutsResp.data.summary || null;
      setOeeAverages(backendSummary);
      setStops(parseStops(stopsResp.data || []));
      return backendSummary;
    } catch (err) {
      console.error('Error fetching OEE data', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const parseStops = (rows) => {
    // paros endpoint returns array of rows where each row is splitted by ; in backend
    return rows.map(r => {
      if (Array.isArray(r)) return r;
      if (typeof r === 'string') return r.split(';');
      return r;
    });
  };

  // Compute OEE aggregates across all machines using definitions:
  // Disponibilidad = (TiempoDisponible - Downtime) / TiempoDisponible
  // - We'll assume TiempoDisponible = 24*60 minutes * number of days in range (minimum 1 day)
  // - Downtime is sum of diferencia_minutos from paros that overlap the date range
  // Calidad = OK / (OK + NOK) using the EOL machine totals. We approximate EOL by selecting the last machine in machinesSummary
  // Eficiencia = total_piezas_finales / (rate * tiempo_productivo_en_minutos)
  // - rate is taken from options (opciones) by matching PN and linea; if missing we won't compute efficiency

  const computeRangeDays = () => {
    try {
      const dFrom = startOfDay(from);
      const dTo = endOfDay(to);
      if (!dFrom || !dTo) return 1;
      const ms = dTo.getTime() - dFrom.getTime();
      const days = Math.max(1, Math.ceil((ms + 1) / (1000 * 60 * 60 * 24)));
      return days;
    } catch (e) { return 1; }
  };

  const sumDowntime = () => {
    // stops rows format (from backend) -> [fecha,area,linea,pn,hora_paro,hora_arranque,diferencia_minutos,...]
    const fromDate = startOfDay(from);
    const toDate = endOfDay(to);
    let total = 0;
    stops.forEach(cols => {
      const fecha = cols[0];
      const min = parseInt(cols[6]) || 0;
      if (!fecha) return;
      const d = parseYYYYMMDD(fecha);
      if (!d) return;
      if (d.getTime() >= fromDate.getTime() && d.getTime() <= toDate.getTime()) total += min;
    });
    return total;
  };

  const computeQuality = (machines) => {
    if (!machines || machines.length === 0) return { ok: 0, nok: 0, percentage: 0 };
    // use last machine as EOL (heuristic)
    const last = machines[machines.length - 1];
    const ok = last.ok || 0;
    const nok = last.nok || 0;
    const perc = (ok + nok) > 0 ? (ok / (ok + nok)) * 100 : 0;
    return { ok, nok, percentage: perc };
  };

  const computeTotals = async () => {
    const days = computeRangeDays();
    const tiempoDisponibleMin = days * 24 * 60; // minutes
    const downtimeMin = sumDowntime();
    const disponibilidad = Math.max(0, ((tiempoDisponibleMin - downtimeMin) / tiempoDisponibleMin) * 100);

    const quality = computeQuality(machinesSummary);

    // Fetch opciones to get rates for PN
    let rate = 0;
    try {
      const opt = await axios.get(`${serverApiUrl}/api/opciones`);
      const opciones = opt.data || {};
      // try get PN from recipe param or from machinesSummary guessing PN
      const pn = recipe || (machinesSummary && machinesSummary.length ? machinesSummary[0].pn : undefined);
      if (pn) {
        const found = (opciones.lineas || []).find(l => String(l.pn) === String(pn));
        if (found) rate = Number(found.rate) || 0;
      }
    } catch (e) {
      console.warn('No se pudo cargar opciones para rate', e);
    }

    // total produced pieces: sum of piezasTotales across cuts (enriched endpoint provides piezasTotales)
    let totalFinal = 0;
    if (daysByMachine && daysByMachine.length) {
      totalFinal = daysByMachine.reduce((s, d) => s + (d.piezasTotales || 0), 0);
    } else if (machinesSummary && machinesSummary.length) {
      const last = machinesSummary[machinesSummary.length - 1];
      totalFinal = (last.ok || 0) + (last.nok || 0);
    }

    let eficienciaPerc = 0;
    if (rate > 0) {
      const potencial = rate * ( (tiempoDisponibleMin - downtimeMin) / 60 ); // rate per hour? assume rate is per hour
      eficienciaPerc = potencial > 0 ? (totalFinal / potencial) * 100 : 0;
    }

    return {
      disponibilidad: Number(disponibilidad.toFixed(2)),
      downtimeMin,
      tiempoDisponibleMin,
      quality: { ...quality, percentage: Number((quality.percentage).toFixed(2)) },
      eficiencia: { rate, totalFinal, porcentaje: Number(eficienciaPerc.toFixed(2)) }
    };
  };

  const [oeeSummary, setOeeSummary] = useState(null);
  // Table filters
  const [filterPN, setFilterPN] = useState('');
  const [filterChangeOver, setFilterChangeOver] = useState(''); // '', 'Si', 'No'
  const [filterMinPiezas, setFilterMinPiezas] = useState('');
  const [filterMinDisp, setFilterMinDisp] = useState(''); // %
  const [filterMinEfic, setFilterMinEfic] = useState(''); // %
  const [filterMinCal, setFilterMinCal] = useState(''); // %

  useEffect(() => {
    const run = async () => {
      if (!from || !to) return;
      setLoading(true);
      try {
        const backendSummary = await fetchAll();
        if (backendSummary) {
          // backend provides averages as fractions (0..1) -> convert to percent and build oeeSummary shape
          setOeeSummary({
            disponibilidad: Number((backendSummary.disponibilidadAvg * 100).toFixed(2)),
            downtimeMin: undefined,
            tiempoDisponibleMin: undefined,
            quality: { ok: undefined, nok: undefined, percentage: Number((backendSummary.calidadAvg * 100).toFixed(2)) },
            eficiencia: { rate: 154, totalFinal: undefined, porcentaje: Number((backendSummary.eficienciaAvg * 100).toFixed(2)) }
          });
        } else {
          const res = await computeTotals();
          setOeeSummary(res);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line
  }, [from, to, recipe]);

  if (!from || !to) return <div>Selecciona un rango de fechas para ver OEE.</div>;
  if (loading || !oeeSummary) return <div>Cargando métricas OEE...</div>;

  const donutOptions = (value, label) => ({
    labels: [label, 'Resto'],
    datasets: [
      {
        data: [value, Math.max(0, 100 - value)],
        backgroundColor: ['#4caf50', '#555'],
      },
    ],
  });

  // Apply client-side filters to cuts list
  const filteredCuts = (daysByMachine || []).filter(d => {
    if (filterPN && !String(d.pn || '').toLowerCase().includes(filterPN.toLowerCase())) return false;
    if (filterChangeOver && String(d.changeOver || 'No') !== filterChangeOver) return false;
    if (filterMinPiezas && (d.piezasTotales || 0) < Number(filterMinPiezas)) return false;
    if (filterMinDisp && typeof d.disponibilidad === 'number' && (d.disponibilidad * 100) < Number(filterMinDisp)) return false;
    if (filterMinEfic && typeof d.eficiencia === 'number' && (d.eficiencia * 100) < Number(filterMinEfic)) return false;
    // d.calidad might be null; compute from EOL if needed
    let calPct = null;
    if (typeof d.calidad === 'number') calPct = d.calidad * 100;
    else {
      const totalOkCalc = d.eolOk || ((d.estaciones || []).reduce((s, st) => s + (st.ok || 0), 0));
      const totalNokCalc = d.eolNok || ((d.estaciones || []).reduce((s, st) => s + (st.nok || 0), 0));
      calPct = (totalOkCalc + totalNokCalc) > 0 ? (totalOkCalc / (totalOkCalc + totalNokCalc)) * 100 : null;
    }
    if (filterMinCal && calPct !== null && calPct < Number(filterMinCal)) return false;
    return true;
  });
  const hasActiveFilters = !!(filterPN || filterChangeOver || filterMinPiezas || filterMinDisp || filterMinEfic || filterMinCal);

  return (
    <div>
      <h2>OEE - {from} → {to}</h2>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18 }}>
        <div style={{ width: 180, textAlign: 'center' }}>
          <Doughnut data={donutOptions(oeeSummary.disponibilidad, 'Disponibilidad %')} />
          <div style={{ color: '#fff', marginTop: 8 }}>Disponibilidad: {oeeSummary.disponibilidad}%</div>
          <div style={{ color: '#ccc', fontSize: 12 }}>Downtime: {oeeSummary.downtimeMin} min</div>
        </div>
        <div style={{ width: 180, textAlign: 'center' }}>
          <Doughnut data={donutOptions(oeeSummary.quality.percentage, 'Calidad %')} />
          <div style={{ color: '#fff', marginTop: 8 }}>Calidad: {oeeSummary.quality.percentage}%</div>
          <div style={{ color: '#ccc', fontSize: 12 }}>OK: {oeeSummary.quality.ok} - NOK: {oeeSummary.quality.nok}</div>
        </div>
        <div style={{ width: 180, textAlign: 'center' }}>
          <Doughnut data={donutOptions(oeeSummary.eficiencia.porcentaje, 'Eficiencia %')} />
          <div style={{ color: '#fff', marginTop: 8 }}>Eficiencia: {oeeSummary.eficiencia.porcentaje}%</div>
          <div style={{ color: '#ccc', fontSize: 12 }}>Rate: {oeeSummary.eficiencia.rate} /h - Piezas: {oeeSummary.eficiencia.totalFinal}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ marginTop: 18, marginBottom: 8 }}>
            Cortes / Producciones (por timestamp)
            <span style={{ color: '#aaa', fontSize: 13, marginLeft: 10 }}>
              Mostrando {filteredCuts.length} de {daysByMachine.length}
            </span>
          </h3>
          {hasActiveFilters && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {filterPN && <span style={chip}>PN contiene: "{filterPN}"</span>}
              {filterChangeOver && <span style={chip}>Change Over: {filterChangeOver}</span>}
              {filterMinPiezas && <span style={chip}>Min Piezas: {filterMinPiezas}</span>}
              {filterMinDisp && <span style={chip}>Disp ≥ {filterMinDisp}%</span>}
              {filterMinEfic && <span style={chip}>Efic ≥ {filterMinEfic}%</span>}
              {filterMinCal && <span style={chip}>Cal ≥ {filterMinCal}%</span>}
              <button style={{ ...styles.btn, background: '#555' }} onClick={() => {
                setFilterPN(''); setFilterChangeOver(''); setFilterMinPiezas(''); setFilterMinDisp(''); setFilterMinEfic(''); setFilterMinCal('');
              }}>Limpiar filtros</button>
            </div>
          )}
        </div>
        <div>
          <button style={{ ...styles.btn, marginRight: 8 }} onClick={async () => {
            try {
              setLoading(true);
              // Trigger generation and fetch enriched CSV on server, endpoint will also return JSON
              await axios.get(`${serverApiUrl}/api/rea-production-eolo-cuts-oee`, { params: { from, to, recipe: recipe || undefined, ratePerHour: 154 } });
              // Then download the generated CSV from static folder
              const resp = await axios.get(`${serverApiUrl}/static/EOL_Cuts_OEE.csv`, { responseType: 'blob' });
              const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `EOL_Cuts_OEE_${from || 'all'}_${to || 'all'}${recipe ? '_' + recipe : ''}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
            } catch (err) {
              console.error('Error generando/descargando CSV OEE', err);
              alert('Error generando o descargando CSV OEE. Revisa la consola.');
            } finally { setLoading(false); }
          }}>Descargar CSV OEE</button>
        </div>
      </div>
      {/* Filters toolbar */}
      <div style={filtersWrap}>
        <div style={filterItemSm}>
          <label style={labelSm}>PN</label>
          <input value={filterPN} onChange={e => setFilterPN(e.target.value)} placeholder="Buscar PN..." style={inputSm} />
        </div>
        <div style={filterItemSm}>
          <label style={labelSm}>Change Over</label>
          <select value={filterChangeOver} onChange={e => setFilterChangeOver(e.target.value)} style={inputSm}>
            <option value="">Todos</option>
            <option value="Si">Si</option>
            <option value="No">No</option>
          </select>
        </div>
        <div style={filterItemSm}>
          <label style={labelSm}>Min Piezas</label>
          <input type="number" min="0" value={filterMinPiezas} onChange={e => setFilterMinPiezas(e.target.value)} placeholder="0" style={inputSm} />
        </div>
        <div style={filterItemSm}>
          <label style={labelSm}>Disp ≥ %</label>
          <input type="number" min="0" max="100" value={filterMinDisp} onChange={e => setFilterMinDisp(e.target.value)} placeholder="%" style={inputSm} />
        </div>
        <div style={filterItemSm}>
          <label style={labelSm}>Efic ≥ %</label>
          <input type="number" min="0" max="100" value={filterMinEfic} onChange={e => setFilterMinEfic(e.target.value)} placeholder="%" style={inputSm} />
        </div>
        <div style={filterItemSm}>
          <label style={labelSm}>Cal ≥ %</label>
          <input type="number" min="0" max="100" value={filterMinCal} onChange={e => setFilterMinCal(e.target.value)} placeholder="%" style={inputSm} />
        </div>
      </div>
  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={th}>Fecha</th>
            <th style={th}>Hora</th>
            <th style={th}>PN</th>
            <th style={th}>Piezas Producidas</th>
            <th style={th}>Downtime (min)</th>
            <th style={th}>Disponibilidad %</th>
            <th style={th}>OK (EOL)</th>
            <th style={th}>NOK (EOL)</th>
            <th style={th}>Calidad %</th>
            <th style={th}>Change Over</th>
            <th style={th}>Rate</th>
            <th style={th}>Eficiencia %</th>
          </tr>
        </thead>
        <tbody>
          {filteredCuts.length === 0 ? (
            <tr><td colSpan={12} style={{ color: '#ccc', padding: 8 }}>No hay cortes para el rango seleccionado</td></tr>
          ) : (
            filteredCuts.map((d, idx) => {
              // the enriched endpoint returns: startISO,endISO,pn,piezasTotales,durationMinutes,downtimeMinutes,disponibilidad,eficiencia,calidad,eolOk,eolNok,estaciones
              const totalOk = d.eolOk || ((d.estaciones || []).reduce((s, st) => s + (st.ok || 0), 0));
              const totalNok = d.eolNok || ((d.estaciones || []).reduce((s, st) => s + (st.nok || 0), 0));
              const rate = oeeSummary?.eficiencia?.rate || 154;
              // eficiencia per cut: piezasTotales / (rate * durationHours)
              const durationHours = Math.max(1/60, (d.durationMinutes || 0) / 60);
              const efficiencyPct = rate > 0 ? ((d.piezasTotales || 0) / (rate * durationHours)) * 100 : 0;

              // Display human-friendly fecha/hora: prefer startISO parsed
              let startDateStr = '';
              try { const sd = new Date(d.startISO || d.startFecha + 'T' + (d.startHora || '00:00:00')); startDateStr = sd.toLocaleDateString() + ' ' + sd.toLocaleTimeString(); } catch (e) { startDateStr = (d.startFecha || '') + ' ' + (d.startHora || ''); }

              // compute quality percent per cut: prefer backend-provided d.calidad (fraction 0..1) or derive from OK/NOK
              const qualityPct = (typeof d.calidad === 'number')
                ? (d.calidad * 100)
                : ((totalOk + totalNok) > 0 ? (totalOk / (totalOk + totalNok)) * 100 : 0);

              return (
                <tr key={idx} style={{ borderTop: '1px solid #444' }}>
                  <td style={td}>{startDateStr.split(' ')[0]}</td>
                  <td style={td}>{startDateStr.split(' ').slice(1).join(' ')}</td>
                  <td style={td}>{d.pn || '-'}</td>
                  <td style={td}>{d.piezasTotales}</td>
                  <td style={td}>{d.downtimeMinutes != null ? d.downtimeMinutes : '-'}</td>
                  <td style={td}>{typeof d.disponibilidad === 'number' ? (d.disponibilidad * 100).toFixed(2) : '-'}</td>
                  <td style={td}>{totalOk}</td>
                  <td style={td}>{totalNok}</td>
                  <td style={td}>{Number(qualityPct).toFixed(2)}</td>
                  <td style={td}>{d.changeOver || (d.changeOver === false ? 'No' : '-')}</td>
                  <td style={td}>{rate || '-'}</td>
                  <td style={td}>{Number(efficiencyPct).toFixed(2)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

const th = {
  textAlign: 'left', padding: '8px 10px', color: '#ddd', borderBottom: '1px solid #555'
};
const td = { padding: '8px 10px', color: '#fff' };

const styles = {
  btn: {
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer'
  }
};

const labelSm = { color: '#ccc', fontSize: 12, marginBottom: 4 };
const inputSm = { padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff', minWidth: 160 };
const chip = { background: '#444', color: '#eee', borderRadius: 20, padding: '4px 10px', fontSize: 12 };
const filtersWrap = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 8 };
const filterItemSm = { display: 'flex', flexDirection: 'column' };

export default ReportsOEEWrapper;
