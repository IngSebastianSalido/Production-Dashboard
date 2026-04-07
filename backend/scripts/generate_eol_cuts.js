const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Lazy load para evitar problemas con __dirname en modo empaquetado
let reaSourceFilePath = null;
let outCsv = null;
let dataDir = null;

function initPaths() {
  if (dataDir) return;
  const isPackaged = process.pkg !== undefined;
  const baseDir = isPackaged ? process.cwd() : (typeof __dirname !== 'undefined' ? path.join(__dirname, '..') : process.cwd());
  dataDir = path.join(baseDir, 'data');
  reaSourceFilePath = process.env.REA_SOURCE_FILE_PATH || path.join(dataDir, 'ProductionReport.csv');
  outCsv = path.join(dataDir, 'EOL_Cuts.csv');
}

function safeParseInt(v){ return isNaN(parseInt(v)) ? 0 : parseInt(v); }

function generateCuts(options = {}){
  initPaths();
  if (!fs.existsSync(reaSourceFilePath)){
    console.error('Source file not found:', reaSourceFilePath);
    throw new Error(`Source file not found: ${reaSourceFilePath}`);
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
    const pn = (cols[2] || 'UNKNOWN').trim();
    // Include all recipes including UNKNOWN
    if (!pn) continue;
    let anyNonZero=false;
    for (let i=3;i<cols.length;i+=2){ if ((safeParseInt(cols[i])+safeParseInt(cols[i+1]))>0){ anyNonZero=true; break; } }
    registros.push({ fecha: rowFecha, hora: cleanHora, fechaHoraReal: fechaHoraObj, acumulado: safeParseInt(cols[eoloIndex]), raw: cols, pn, anyNonZero });
  }

  registros.sort((a,b)=>a.fechaHoraReal - b.fechaHoraReal);

  // Nueva lógica: generar cortes por turno + cambios de receta
  // Definir turnos fijos: 7AM-3PM, 3PM-10:30PM, 10:30PM-7AM
  const SHIFTS = [
    { name: 'Turno 1', start: 7*60, end: 15*60 },          // 7:00-15:00 (7AM-3PM)
    { name: 'Turno 2', start: 15*60, end: 22*60+30 },      // 15:00-22:30 (3PM-10:30PM)
    { name: 'Turno 3', start: 22*60+30, end: 24*60+7*60 }  // 22:30-31:00 (10:30PM-7AM del día siguiente)
  ];

  // Función para obtener minutos desde medianoche
  function getMinutesFromMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  // Función para determinar el turno de una fecha/hora
  function getShift(date) {
    const mins = getMinutesFromMidnight(date);
    for (const shift of SHIFTS) {
      if (shift.start < shift.end) { // turno en el mismo día
        if (mins >= shift.start && mins < shift.end) return shift;
      } else { // turno que cruza medianoche (Turno 3)
        if (mins >= shift.start || mins < (shift.end - 24*60)) return shift;
      }
    }
    return SHIFTS[0]; // default
  }

  // Calcular deltas normales
  const deltas = [];
  let prev = null;
  const arg = process.argv.find(a=>a.startsWith('--minPrevAccum='));
  const MIN_PREVIOUS_ACCUM = (typeof options.minPrevAccum === 'number')
    ? options.minPrevAccum
    : (arg ? parseInt(arg.split('=')[1]) : 5);
  
  for (let i=0;i<registros.length;i++){
    const r = registros[i];
    let deltaEol = 0;
    let isReset = false;
    
    if (!prev) deltaEol = 0;
    else {
      if (r.acumulado >= prev.acumulado) deltaEol = r.acumulado - prev.acumulado;
      else {
        if ((prev.acumulado||0) >= MIN_PREVIOUS_ACCUM){ 
          deltaEol = 0; 
          isReset = true; 
        } else { 
          const diff = r.acumulado - prev.acumulado; 
          deltaEol = diff>0?diff:0; 
        }
      }
    }
    
    const stationDeltas = [];
    for (let j=3;j<r.raw.length;j+=2){
      const name = (header[j]||`Est${j}`).replace(/ok$/i,'');
      const ok = safeParseInt(r.raw[j]);
      const nok = safeParseInt(r.raw[j+1]);
      let dOk=0,dNok=0;
      if (prev){ 
        const prevOk = safeParseInt(prev.raw[j]); 
        const prevNok = safeParseInt(prev.raw[j+1]); 
        dOk = ok - prevOk; 
        dNok = nok - prevNok; 
        dOk = dOk>0?dOk:0; 
        dNok = dNok>0?dNok:0; 
      }
      stationDeltas.push({ station: name, ok: dOk, nok: dNok });
    }
    
    deltas.push({ 
      index: i, 
      fecha: r.fecha, 
      hora: r.hora, 
      fechaHoraReal: r.fechaHoraReal, 
      acumulado: r.acumulado, 
      deltaEol, 
      stationDeltas, 
      pn: r.pn, 
      isReset 
    });
    prev = r;
  }

  // Identificar rango de fechas
  let cuts = [];
  
  if (deltas.length === 0) {
    console.warn('No deltas to process');
  } else {
    const minDate = new Date(deltas[0].fechaHoraReal);
    const maxDate = new Date(deltas[deltas.length-1].fechaHoraReal);
    
    // Generar todos los días en el rango
    const allDays = [];
    const currentDate = new Date(minDate);
    currentDate.setHours(0,0,0,0);
    
    while (currentDate <= maxDate) {
      allDays.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Para cada día, generar cortes por turno
    for (const day of allDays) {
      for (let shiftIdx = 0; shiftIdx < SHIFTS.length; shiftIdx++) {
        const shift = SHIFTS[shiftIdx];
        // Calcular inicio y fin del turno
        let shiftStart = new Date(day);
        let shiftEnd = new Date(day);
        
        shiftStart.setHours(Math.floor(shift.start / 60), shift.start % 60, 0, 0);
        
        if (shift.end > 24*60) { // cruza medianoche
          shiftEnd.setDate(shiftEnd.getDate() + 1);
          shiftEnd.setHours(Math.floor((shift.end - 24*60) / 60), (shift.end - 24*60) % 60, 0, 0);
        } else {
          shiftEnd.setHours(Math.floor(shift.end / 60), shift.end % 60, 0, 0);
        }

        // Filtrar registros dentro de este turno
        const shiftDeltas = deltas.filter(d => 
          d.fechaHoraReal >= shiftStart && d.fechaHoraReal < shiftEnd
        );

        if (shiftDeltas.length === 0) {
          // Turno sin datos - generar corte vacío
          const startFecha = `${shiftStart.getMonth()+1}/${shiftStart.getDate()}/${shiftStart.getFullYear()}`;
          const startHora = `${String(shiftStart.getHours()).padStart(2,'0')}:${String(shiftStart.getMinutes()).padStart(2,'0')}:00`;
          const endFecha = `${shiftEnd.getMonth()+1}/${shiftEnd.getDate()}/${shiftEnd.getFullYear()}`;
          const endHora = `${String(shiftEnd.getHours()).padStart(2,'0')}:${String(shiftEnd.getMinutes()).padStart(2,'0')}:00`;
          
          // Generar Batch ID para turno sin producción
          const month = String(shiftStart.getMonth() + 1).padStart(2, '0');
          const dayNum = String(shiftStart.getDate()).padStart(2, '0');
          const year = shiftStart.getFullYear();
          const shiftNum = shiftIdx + 1;
          const batchId = `D${month}${dayNum}${year}S${shiftNum}C1`;
          
          cuts.push({ 
            batchId,
            startFecha, 
            startHora, 
            endFecha, 
            endHora, 
            pn: 'NO_PRODUCTION', 
            piezasTotales: 0, 
            estaciones: [], 
            startAccum: 0, 
            endAccum: 0 
          });
          continue;
        }

        // Detectar cambios de receta dentro del turno
        // Solo dividir cuando cambia la receta (PN)
        const recipeCuts = [];
        let currentRecipe = shiftDeltas[0].pn;
        let cutStartIdx = 0;

        for (let i = 1; i < shiftDeltas.length; i++) {
          const currRecipe = shiftDeltas[i].pn;
          
          // Dividir solo si cambia la receta
          if (currRecipe !== currentRecipe) {
            recipeCuts.push({ startIdx: cutStartIdx, endIdx: i - 1, pn: currentRecipe });
            cutStartIdx = i;
            currentRecipe = currRecipe;
          }
        }
        // Último corte del turno
        recipeCuts.push({ startIdx: cutStartIdx, endIdx: shiftDeltas.length - 1, pn: currentRecipe });

        // Generar cortes
        for (let cutIdx = 0; cutIdx < recipeCuts.length; cutIdx++) {
          const rc = recipeCuts[cutIdx];
          
          // Generar Batch ID: D[MMDDYYYY]S[#]C[#]
          const month = String(shiftStart.getMonth() + 1).padStart(2, '0');
          const dayNum = String(shiftStart.getDate()).padStart(2, '0');
          const year = shiftStart.getFullYear();
          const shiftNum = shiftIdx + 1;
          const cutNum = cutIdx + 1;
          const batchId = `D${month}${dayNum}${year}S${shiftNum}C${cutNum}`;
          const startRec = shiftDeltas[rc.startIdx];
          const endRec = shiftDeltas[rc.endIdx];
          
          let cutSum = 0;
          let cutStationSums = {};
          
          for (let k = rc.startIdx; k <= rc.endIdx; k++) {
            const d = shiftDeltas[k];
            cutSum += d.deltaEol;
            d.stationDeltas.forEach(sd => {
              if (!cutStationSums[sd.station]) cutStationSums[sd.station] = {ok:0, nok:0};
              cutStationSums[sd.station].ok += sd.ok;
              cutStationSums[sd.station].nok += sd.nok;
            });
          }
          
          const estacionesArr = Object.keys(cutStationSums).map(s => ({
            station: s, 
            ok: cutStationSums[s].ok, 
            nok: cutStationSums[s].nok
          }));

          // Determinar tiempos de inicio y fin
          // Si es el único corte del turno completo, usar horarios de turno
          // Si hay múltiples cortes (cambio de receta), usar horarios reales
          let cutStartFecha, cutStartHora, cutEndFecha, cutEndHora;
          
          if (recipeCuts.length === 1) {
            // Único corte - usar horarios del turno
            cutStartFecha = `${shiftStart.getMonth()+1}/${shiftStart.getDate()}/${shiftStart.getFullYear()}`;
            cutStartHora = `${String(shiftStart.getHours()).padStart(2,'0')}:${String(shiftStart.getMinutes()).padStart(2,'0')}:00`;
            cutEndFecha = `${shiftEnd.getMonth()+1}/${shiftEnd.getDate()}/${shiftEnd.getFullYear()}`;
            cutEndHora = `${String(shiftEnd.getHours()).padStart(2,'0')}:${String(shiftEnd.getMinutes()).padStart(2,'0')}:00`;
          } else {
            // Múltiples cortes - usar horarios reales pero ajustar inicio/fin de turno
            if (rc.startIdx === 0) {
              // Primer corte del turno - inicio = inicio del turno
              cutStartFecha = `${shiftStart.getMonth()+1}/${shiftStart.getDate()}/${shiftStart.getFullYear()}`;
              cutStartHora = `${String(shiftStart.getHours()).padStart(2,'0')}:${String(shiftStart.getMinutes()).padStart(2,'0')}:00`;
            } else {
              cutStartFecha = startRec.fecha;
              cutStartHora = startRec.hora;
            }
            
            if (rc.endIdx === shiftDeltas.length - 1) {
              // Último corte del turno - fin = fin del turno
              cutEndFecha = `${shiftEnd.getMonth()+1}/${shiftEnd.getDate()}/${shiftEnd.getFullYear()}`;
              cutEndHora = `${String(shiftEnd.getHours()).padStart(2,'0')}:${String(shiftEnd.getMinutes()).padStart(2,'0')}:00`;
            } else {
              cutEndFecha = endRec.fecha;
              cutEndHora = endRec.hora;
            }
          }

          cuts.push({ 
            batchId,
            startFecha: cutStartFecha, 
            startHora: cutStartHora, 
            endFecha: cutEndFecha, 
            endHora: cutEndHora, 
            pn: rc.pn || 'UNKNOWN', 
            piezasTotales: cutSum, 
            estaciones: estacionesArr, 
            startAccum: startRec.acumulado, 
            endAccum: endRec.acumulado 
          });
        }
      }
    }
  }

  // write CSV
  const csvHeader = 'batchId,startFecha,startHora,startFechaHoraISO,endFecha,endHora,endFechaHoraISO,pn,piezasTotales,startAccum,endAccum,stations_json\n';
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
    const row = `${c.batchId||''},${c.startFecha},${c.startHora},${startISO},${c.endFecha},${c.endHora},${endISO},"${(c.pn||'').replace(/\"/g,'')}",${c.piezasTotales||0},${c.startAccum||0},${c.endAccum||0},"${stationsJson.replace(/"/g,'""')}"\n`;
    csvContent += row;
  }
  fs.writeFileSync(outCsv, csvContent, 'utf8');
  console.log('Generated', outCsv, 'with', cuts.length, 'cuts');
}

// adicional: generar CSV enriquecido con OEE
function generateEnriched(ratePerHour = 154){
  initPaths();
  const eolCsv = outCsv;
  const enrichedOut = path.join(dataDir, 'EOL_Cuts_OEE.csv');
  if (!fs.existsSync(eolCsv)) { console.warn('EOL_Cuts.csv not found, skipping enriched generation'); return; }
  const csvRaw = fs.readFileSync(eolCsv, 'utf8');
  const rows = csvRaw.split('\n').filter(r=>r.trim()!== '');
  const dataRows = rows.slice(1);

  // read stops (paros.csv)
  const stopsPath = path.join(dataDir, 'paros.csv');
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
    // Eficiencia = Piezas Producidas / (Tiempo Disponible * Rate/hora) - usar availableMinutes en lugar de durationMinutes
    const availableHours = Math.max(1/60, availableMinutes/60); const expectedPieces = ratePerHour * availableHours; const eficiencia = expectedPieces>0 ? (piezasTotales/expectedPieces) : 0;
    let eolOk=null, eolNok=null, calidad=null; for (const st of stations){ if (String(st.station||'').toLowerCase().includes('eol')){ eolOk = parseInt(st.ok)||0; eolNok = parseInt(st.nok)||0; const denom = eolOk + eolNok; calidad = denom>0 ? (eolOk/denom) : null; break; } }
  enriched.push({ startISO: cutStart.toISOString(), endISO: cutEnd.toISOString(), pn, piezasTotales, durationMinutes, downtimeMinutes, disponibilidad, eficiencia, calidad, eolOk, eolNok, estaciones: stations });
  }

  // write
  const outHeader = 'startISO,endISO,pn,piezasTotales,durationMinutes,downtimeMinutes,disponibilidad,eficiencia,calidad,eolOk,eolNok,stations_json\n';
  let outContent = outHeader; for (const e of enriched){ const row = `${e.startISO},${e.endISO},"${(e.pn||'').replace(/"/g,'')}",${e.piezasTotales},${e.durationMinutes},${e.downtimeMinutes},${e.disponibilidad.toFixed(4)},${e.eficiencia.toFixed(4)},${e.calidad===null?'':e.calidad.toFixed(4)},${e.eolOk||0},${e.eolNok||0},"${JSON.stringify(e.estaciones).replace(/"/g,'""')}"\n`; outContent += row; }
  fs.writeFileSync(enrichedOut, outContent, 'utf8');
  console.log('Generated', enrichedOut, 'with', enriched.length, 'rows');
}

function runCli(){
  generateCuts();
  // run extra generation with default rate or CLI override --rate=154
  const rateArg = process.argv.find(a=>a.startsWith('--rate='));
  const rateVal = rateArg ? parseFloat(rateArg.split('=')[1]) : 154;
  generateEnriched(rateVal);
}

if (require.main === module) {
  runCli();
}

module.exports = { generateCuts, generateEnriched };
