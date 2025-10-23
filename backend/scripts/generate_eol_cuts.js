const fs = require('fs');
const path = require('path');
require('dotenv').config();

const reaSourceFilePath = process.env.REA_SOURCE_FILE_PATH || path.join(__dirname, '..', 'data', 'ProductionReport.csv');
const outCsv = path.join(__dirname, '..', 'data', 'EOL_Cuts.csv');

function safeParseInt(v){ return isNaN(parseInt(v)) ? 0 : parseInt(v); }

function generateCuts(){
  if (!fs.existsSync(reaSourceFilePath)){
    console.error('Source file not found:', reaSourceFilePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(reaSourceFilePath,'utf8');
  const rows = raw.split('\n').filter(r=>r.trim()!=="");
  const header = rows[0].split(';');
  const dataRows = rows.slice(-40000);

  const eoloIndex = header.findIndex(col=>col.toLowerCase().includes('eolok'));
  if (eoloIndex === -1){
    console.error('EOLOk column not found in header');
    process.exit(1);
  }

  const registros = [];
  for (const row of dataRows){
    const cols = row.split(';');
    const rowFecha = cols[0];
    const rowHora = cols[1];
    if (!rowFecha || !rowHora) continue;
    const cleanHora = rowHora.replace('a. m.','AM').replace('p. m.','PM').trim();
    const fechaHoraObj = new Date(`${rowFecha} ${cleanHora}`);
    if (isNaN(fechaHoraObj)) continue;
    const pn = cols[2] || '';
    let anyNonZero=false;
    for (let i=3;i<cols.length;i+=2){ if ((safeParseInt(cols[i])+safeParseInt(cols[i+1]))>0){ anyNonZero=true; break; } }
    registros.push({ fecha: rowFecha, hora: cleanHora, fechaHoraReal: fechaHoraObj, acumulado: safeParseInt(cols[eoloIndex]), raw: cols, pn, anyNonZero });
  }

  registros.sort((a,b)=>a.fechaHoraReal - b.fechaHoraReal);

  // remove isolated zero rows
  const keep = new Array(registros.length).fill(true);
  for (let i=0;i<registros.length;i++){
    if (!registros[i].anyNonZero){
      const prev = registros[i-1];
      const next = registros[i+1];
      if (prev && next && prev.anyNonZero && next.anyNonZero) keep[i]=false;
    }
  }
  const filtered = registros.filter((r,idx)=>keep[idx]);

  const deltas = [];
  let prev = null;
  // allow override via CLI: --minPrevAccum=10
  const arg = process.argv.find(a=>a.startsWith('--minPrevAccum='));
  const MIN_PREVIOUS_ACCUM = arg ? parseInt(arg.split('=')[1]) : 5;
  for (let i=0;i<filtered.length;i++){
    const r = filtered[i];
    let deltaEol = 0;
    if (!prev) deltaEol = 0;
    else {
      if (r.acumulado >= prev.acumulado) deltaEol = r.acumulado - prev.acumulado;
      else {
        if ((prev.acumulado||0) >= MIN_PREVIOUS_ACCUM){ deltaEol = 0; r._isReset = true; }
        else { const diff = r.acumulado - prev.acumulado; deltaEol = diff>0?diff:0; }
      }
    }
    const stationDeltas = [];
    for (let j=3;j<r.raw.length;j+=2){
      const name = (header[j]||`Est${j}`).replace(/ok$/i,'');
      const ok = safeParseInt(r.raw[j]);
      const nok = safeParseInt(r.raw[j+1]);
      let dOk=0,dNok=0;
      if (prev){ const prevOk = safeParseInt(prev.raw[j]); const prevNok = safeParseInt(prev.raw[j+1]); dOk = ok - prevOk; dNok = nok - prevNok; dOk = dOk>0?dOk:0; dNok = dNok>0?dNok:0; }
      stationDeltas.push({ station: name, ok: dOk, nok: dNok });
    }
    deltas.push({ index: i, fecha: r.fecha, hora: r.hora, fechaHoraReal: r.fechaHoraReal, acumulado: r.acumulado, deltaEol, stationDeltas, pn: r.pn, _isReset: r._isReset||false });
    prev = r;
  }

  // group into cuts
  const cuts = [];
  let cutStartIdx = 0; let cutSum = 0; let cutStationSums = {};
  for (let k=0;k<deltas.length;k++){
    const d = deltas[k];
    cutSum += d.deltaEol;
    d.stationDeltas.forEach(sd=>{ if (!cutStationSums[sd.station]) cutStationSums[sd.station]={ok:0,nok:0}; cutStationSums[sd.station].ok += sd.ok; cutStationSums[sd.station].nok += sd.nok; });
    if (d._isReset){
      const startRec = deltas[cutStartIdx];
      const endRec = deltas[k-1] || deltas[cutStartIdx];
      const estacionesArr = Object.keys(cutStationSums).map(s=>({station:s, ok: cutStationSums[s].ok, nok: cutStationSums[s].nok}));
      if (cutSum>0){ cuts.push({ startFecha: startRec.fecha, startHora: startRec.hora, endFecha: endRec.fecha, endHora: endRec.hora, pn: endRec.pn||startRec.pn, piezasTotales: cutSum, estaciones: estacionesArr, startAccum: startRec.acumulado, endAccum: endRec.acumulado }); }
      cutStartIdx = k; cutSum = 0; cutStationSums = {};
    }
  }
  if (cutSum>0){ const startRec = deltas[cutStartIdx]; const endRec = deltas[deltas.length-1]; const estacionesArr = Object.keys(cutStationSums).map(s=>({station:s, ok: cutStationSums[s].ok, nok: cutStationSums[s].nok})); cuts.push({ startFecha: startRec.fecha, startHora: startRec.hora, endFecha: endRec.fecha, endHora: endRec.hora, pn: endRec.pn||startRec.pn, piezasTotales: cutSum, estaciones: estacionesArr, startAccum: startRec.acumulado, endAccum: endRec.acumulado }); }

  // write CSV
  const csvHeader = 'startFecha,startHora,startFechaHoraISO,endFecha,endHora,endFechaHoraISO,pn,piezasTotales,startAccum,endAccum,stations_json\n';
  let csvContent = csvHeader;
  for (const c of cuts){
    const startParts = String(c.startFecha).split('/');
    let startISO = '';
    if (startParts.length===3) startISO = `${startParts[2]}-${startParts[0].padStart(2,'0')}-${startParts[1].padStart(2,'0')}T${c.startHora}`;
    else startISO = new Date(`${c.startFecha} ${c.startHora}`).toISOString();
    const endParts = String(c.endFecha).split('/');
    let endISO = '';
    if (endParts.length===3) endISO = `${endParts[2]}-${endParts[0].padStart(2,'0')}-${endParts[1].padStart(2,'0')}T${c.endHora}`;
    else endISO = new Date(`${c.endFecha} ${c.endHora}`).toISOString();
    const stationsJson = JSON.stringify(c.estaciones||[]);
    const row = `${c.startFecha},${c.startHora},${startISO},${c.endFecha},${c.endHora},${endISO},"${(c.pn||'').replace(/\"/g,'')}",${c.piezasTotales||0},${c.startAccum||0},${c.endAccum||0},"${stationsJson.replace(/"/g,'""')}"\n`;
    csvContent += row;
  }
  fs.writeFileSync(outCsv, csvContent, 'utf8');
  console.log('Generated', outCsv, 'with', cuts.length, 'cuts');
}

generateCuts();

// adicional: generar CSV enriquecido con OEE
function generateEnriched(ratePerHour = 154){
  const eolCsv = outCsv;
  const enrichedOut = path.join(__dirname, '..', 'data', 'EOL_Cuts_OEE.csv');
  if (!fs.existsSync(eolCsv)) { console.warn('EOL_Cuts.csv not found, skipping enriched generation'); return; }
  const csvRaw = fs.readFileSync(eolCsv, 'utf8');
  const rows = csvRaw.split('\n').filter(r=>r.trim()!== '');
  const dataRows = rows.slice(1);

  // read stops
  const stopsPath = path.join(__dirname, '..', 'data', 'stops.csv');
  let stops = [];
  if (fs.existsSync(stopsPath)){
    const stopsRaw = fs.readFileSync(stopsPath, 'utf8');
    const srows = stopsRaw.split('\n').filter(r=>r.trim()!=='');
    for (const line of srows.slice(1)){
      const cols = line.split(';');
      const fecha = (cols[0]||'').trim(); const hora_paro = (cols[4]||'').trim(); const hora_arranque = (cols[5]||'').trim();
      if (!fecha || !hora_paro || !hora_arranque) continue;
      let fechaNorm = fecha;
      if (fecha.includes('/')){ const p = fecha.split('/'); if (p.length===3) fechaNorm = `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`; }
      const start = new Date(`${fechaNorm}T${hora_paro}:00`);
      const end = new Date(`${fechaNorm}T${hora_arranque}:00`);
      if (isNaN(start) || isNaN(end)) continue;
      stops.push({ start, end });
    }
  }

  const enriched = [];
  // helper to split CSV respecting quotes
  function splitCsvLine(line){ const out=[]; let cur=''; let inQ=false; for (let i=0;i<line.length;i++){ const ch=line[i]; if (ch==='"'){ if (inQ && line[i+1]==='"'){ cur+="\""; i++; continue; } inQ=!inQ; continue; } if (ch===',' && !inQ){ out.push(cur); cur=''; continue; } cur+=ch; } out.push(cur); return out; }

  function parseISOFromParts(dateStr, timeStr, isoStr){ if (isoStr && String(isoStr).trim()!==''){ const cleaned = String(isoStr).trim().replace(/\s+(AM|PM)$/i,''); const d = new Date(cleaned); if (!isNaN(d)) return d; } let dateISO = dateStr; if (dateStr && dateStr.includes('/')){ const p=dateStr.split('/'); if (p.length===3) dateISO = `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`; } let time = (timeStr||'').trim(); const ampm = /\b(AM|PM)\b/i.exec(time); if (ampm){ const m = time.match(/(\d{1,2}):(\d{2}):(\d{2})/); if (m){ let hh = parseInt(m[1],10); const mm=m[2]; const ss=m[3]; const ap=ampm[1].toUpperCase(); if (ap==='PM' && hh<12) hh+=12; if (ap==='AM' && hh===12) hh=0; time = `${String(hh).padStart(2,'0')}:${mm}:${ss}`; } } const final = new Date(`${dateISO}T${time}`); return isNaN(final)?null:final; }

  for (const row of dataRows){
    const parts = splitCsvLine(row); if (parts.length<11) continue;
    const startFecha = parts[0]; const startHora = parts[1]; const startISOraw = parts[2]; const endFecha = parts[3]; const endHora = parts[4]; const endISOraw = parts[5]; const pn = parts[6]?parts[6].replace(/^"|"$/g,'') : ''; const piezasTotales = parseInt(parts[7])||0; const stationsJsonRaw = parts[10] || parts[parts.length-1];
    let stations = [];
    try { stations = JSON.parse(stationsJsonRaw.replace(/""/g,'"').replace(/^"|"$/g,'')); } catch(e){ stations = []; }
    const cutStart = parseISOFromParts(startFecha, startHora, startISOraw); const cutEnd = parseISOFromParts(endFecha, endHora, endISOraw); if (!cutStart || !cutEnd) continue;
    let downtimeMinutes = 0; for (const s of stops){ const overlapMs = Math.max(0, Math.min(s.end.getTime(), cutEnd.getTime()) - Math.max(s.start.getTime(), cutStart.getTime())); downtimeMinutes += Math.round(overlapMs/60000); }
    const durationMinutes = Math.max(1, Math.round((cutEnd.getTime()-cutStart.getTime())/60000)); const availableMinutes = Math.max(0, durationMinutes - downtimeMinutes); const disponibilidad = durationMinutes>0 ? (availableMinutes/durationMinutes) : 0;
    const durationHours = Math.max(1/60, durationMinutes/60); const expectedPieces = ratePerHour * durationHours; const eficiencia = expectedPieces>0 ? (piezasTotales/expectedPieces) : 0;
    let eolOk=null, eolNok=null, calidad=null; for (const st of stations){ if (String(st.station||'').toLowerCase().includes('eol')){ eolOk = parseInt(st.ok)||0; eolNok = parseInt(st.nok)||0; const denom = eolOk + eolNok; calidad = denom>0 ? (eolOk/denom) : null; break; } }
  enriched.push({ startISO: cutStart.toISOString(), endISO: cutEnd.toISOString(), pn, piezasTotales, durationMinutes, downtimeMinutes, disponibilidad, eficiencia, calidad, eolOk, eolNok, estaciones: stations });
  }

  // write
  const outHeader = 'startISO,endISO,pn,piezasTotales,durationMinutes,downtimeMinutes,disponibilidad,eficiencia,calidad,eolOk,eolNok,stations_json\n';
  let outContent = outHeader; for (const e of enriched){ const row = `${e.startISO},${e.endISO},"${(e.pn||'').replace(/"/g,'')}",${e.piezasTotales},${e.durationMinutes},${e.downtimeMinutes},${e.disponibilidad.toFixed(4)},${e.eficiencia.toFixed(4)},${e.calidad===null?'':e.calidad.toFixed(4)},${e.eolOk||0},${e.eolNok||0},"${JSON.stringify(e.estaciones).replace(/"/g,'""')}"\n`; outContent += row; }
  fs.writeFileSync(enrichedOut, outContent, 'utf8');
  console.log('Generated', enrichedOut, 'with', enriched.length, 'rows');
}

// run extra generation with default rate or CLI override --rate=154
const rateArg = process.argv.find(a=>a.startsWith('--rate=')); const rateVal = rateArg ? parseFloat(rateArg.split('=')[1]) : 154; generateEnriched(rateVal);
