import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Doughnut } from 'react-chartjs-2';

// Simple OEE wrapper component that fetches needed data and computes
// Disponibilidad, Calidad y Eficiencia. It also shows a table per "corte" (production resets)

const ReportsOEEWrapper = ({ from, to, recipe, data: summaryData, recipes }) => {
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const [loading, setLoading] = useState(false);
  const [machinesSummary, setMachinesSummary] = useState([]);
  const [daysByMachine, setDaysByMachine] = useState([]);
  const [stops, setStops] = useState([]);

  useEffect(() => {
    if (!from || !to) return;
    fetchAll();
    // eslint-disable-next-line
  }, [from, to, recipe]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryResp, daysResp, stopsResp] = await Promise.all([
        axios.get(`${serverApiUrl}/api/reports/production-summary`, { params: { from, to, recipe: recipe || undefined } }),
        axios.get(`${serverApiUrl}/api/reports/production-by-day`, { params: { from, to, recipe: recipe || undefined } }),
        axios.get(`${serverApiUrl}/api/paros`),
      ]);

      setMachinesSummary(summaryResp.data.machines || []);
      setDaysByMachine(daysResp.data.days || []);
      setStops(parseStops(stopsResp.data || []));
    } catch (err) {
      console.error('Error fetching OEE data', err);
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
      const dFrom = new Date(from + 'T00:00:00');
      const dTo = new Date(to + 'T23:59:59');
      const ms = dTo - dFrom;
      const days = Math.max(1, Math.ceil((ms + 1) / (1000 * 60 * 60 * 24)));
      return days;
    } catch (e) { return 1; }
  };

  const sumDowntime = () => {
    // stops rows format (from backend) -> [fecha,area,linea,pn,hora_paro,hora_arranque,diferencia_minutos,...]
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59');
    let total = 0;
    stops.forEach(cols => {
      const fecha = cols[0];
      const min = parseInt(cols[6]) || 0;
      if (!fecha) return;
      const d = new Date(fecha + 'T00:00:00');
      if (d >= fromDate && d <= toDate) total += min;
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

    // total produced pieces (use sum of last machine ok + nok)
    let totalFinal = 0;
    if (machinesSummary && machinesSummary.length) {
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

  useEffect(() => {
    const run = async () => {
      if (!from || !to) return;
      setLoading(true);
      try {
        await fetchAll();
        const res = await computeTotals();
        setOeeSummary(res);
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

      <h3 style={{ marginTop: 18 }}>Cortes / Producciones por día</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={th}>Fecha</th>
            <th style={th}>PN</th>
            <th style={th}>Downtime (min)</th>
            <th style={th}>Disponibilidad %</th>
            <th style={th}>OK (final)</th>
            <th style={th}>NOK (final)</th>
            <th style={th}>Calidad %</th>
            <th style={th}>Rate</th>
            <th style={th}>Eficiencia %</th>
          </tr>
        </thead>
        <tbody>
          {daysByMachine.length === 0 ? (
            <tr><td colSpan={9} style={{ color: '#ccc', padding: 8 }}>No hay cortes para el rango seleccionado</td></tr>
          ) : (
            daysByMachine.map((d, idx) => {
              // d: { date, oks: [], noks: [] }
              // sum across machines for final OK/NOK
              const totalOk = (d.oks || []).reduce((s, v) => s + (v || 0), 0);
              const totalNok = (d.noks || []).reduce((s, v) => s + (v || 0), 0);
              const qualityPerc = (totalOk + totalNok) > 0 ? (totalOk / (totalOk + totalNok)) * 100 : 0;
              // downtime per day from stops
              const downtimeDay = stops.filter(s => s[0] === d.date).reduce((suma, row) => suma + (parseInt(row[6]) || 0), 0);
              const tiempoDisponible = 24 * 60;
              const disponibilidadDia = ((tiempoDisponible - downtimeDay) / tiempoDisponible) * 100;

              // rate lookup naive: try recipe or first PN
              const pn = recipe || (machinesSummary && machinesSummary.length ? machinesSummary[0].pn : '');
              // we'll attempt to fetch rate synchronously is expensive; reuse previous opt fetch would be better but keep simple

              return (
                <tr key={idx} style={{ borderTop: '1px solid #444' }}>
                  <td style={td}>{d.date}</td>
                  <td style={td}>{pn || '-'}</td>
                  <td style={td}>{downtimeDay}</td>
                  <td style={td}>{disponibilidadDia.toFixed(2)}</td>
                  <td style={td}>{totalOk}</td>
                  <td style={td}>{totalNok}</td>
                  <td style={td}>{qualityPerc.toFixed(2)}</td>
                  <td style={td}>{oeeSummary.eficiencia.rate || '-'}</td>
                  <td style={td}>{oeeSummary.eficiencia.porcentaje}</td>
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

export default ReportsOEEWrapper;
