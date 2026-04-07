import React, { useEffect, useMemo, useState } from 'react';
import '../styles/HeijunkaPage.css';
import { buildWeekSlots, DAY_START_HOUR, generateWeeklyPlan, getWeekDays } from '../utils/heijunkaUtils';

const API_URL = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

const getCurrentWeekStart = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return monday.toISOString().split('T')[0];
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = (DAY_START_HOUR + i) % 24;
  const label = `${String(hour).padStart(2, '0')}:00`;
  return { value: label, label };
});

const DISPLAY_HOURS = Array.from({ length: 24 }, (_, i) => (DAY_START_HOUR + i) % 24);

const HeijunkaPage = () => {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [batches, setBatches] = useState([]);
  const [maintenanceBlocks, setMaintenanceBlocks] = useState([]);
  const [setupBlocks, setSetupBlocks] = useState([]);
  const [programmedStopBlocks, setProgrammedStopBlocks] = useState([]);
  const [plannedStopBlocks, setPlannedStopBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [batchForm, setBatchForm] = useState({ pn: '', pcsPerTarima: '', hourRate: '', tarimas: '' });
  const [blockForm, setBlockForm] = useState({ type: 'maintenance', dayDate: '', time: '07:00', duration: '1' });
  const [programmedStopForm, setProgrammedStopForm] = useState({ dayDate: '', time: '07:00', duration: '1' });
  const [plannedStopForm, setPlannedStopForm] = useState({ dayDate: '', time: '07:00', duration: '1' });

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekSlots = useMemo(() => buildWeekSlots(weekStart), [weekStart]);

  useEffect(() => {
    if (weekDays.length > 0) {
      setBlockForm((prev) => ({ ...prev, dayDate: weekDays[0].date }));
      setProgrammedStopForm((prev) => ({ ...prev, dayDate: weekDays[0].date }));
      setPlannedStopForm((prev) => ({ ...prev, dayDate: weekDays[0].date }));
    }
  }, [weekDays]);

  const plan = useMemo(
    () => generateWeeklyPlan(batches, maintenanceBlocks, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart),
    [batches, maintenanceBlocks, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart]
  );

  const saveConfigurationWithData = async (payload) => {
    try {
      await fetch(`${API_URL}/api/heijunka/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  useEffect(() => {
    const loadConfigurationByWeek = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}/api/heijunka/config?weekStart=${encodeURIComponent(weekStart)}`);

        if (!response.ok) {
          setBatches([]);
          setMaintenanceBlocks([]);
          setSetupBlocks([]);
          return;
        }

        const data = await response.json();
        setBatches(Array.isArray(data.batches) ? data.batches : []);
        setMaintenanceBlocks(Array.isArray(data.maintenanceBlocks) ? data.maintenanceBlocks : []);
        setSetupBlocks(Array.isArray(data.setupBlocks) ? data.setupBlocks : []);
        setProgrammedStopBlocks(Array.isArray(data.programmedStopBlocks) ? data.programmedStopBlocks : []);
        setPlannedStopBlocks(Array.isArray(data.plannedStopBlocks) ? data.plannedStopBlocks : []);
      } catch (error) {
        console.error('Error loading configuration:', error);
        setBatches([]);
        setMaintenanceBlocks([]);
        setSetupBlocks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfigurationByWeek();
  }, [weekStart]);

  const persistAll = (nextBatches, nextMaintenance, nextSetup, nextProgrammedStop, nextPlannedStop, nextWeekStart) => {
    saveConfigurationWithData({
      batches: nextBatches,
      maintenanceBlocks: nextMaintenance,
      setupBlocks: nextSetup,
      programmedStopBlocks: nextProgrammedStop,
      plannedStopBlocks: nextPlannedStop,
      weekStart: nextWeekStart
    });
  };

  const moveWeek = (direction) => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
    const nextWeekStart = d.toISOString().split('T')[0];
    setWeekStart(nextWeekStart);
  };

  const goToCurrentWeek = () => {
    const nextWeekStart = getCurrentWeekStart();
    setWeekStart(nextWeekStart);
  };

  const addBatch = () => {
    if (!batchForm.pn || !batchForm.pcsPerTarima || !batchForm.hourRate || !batchForm.tarimas) return;

    const newBatch = {
      id: Date.now(),
      pn: batchForm.pn.trim(),
      pcsPerTarima: Number(batchForm.pcsPerTarima),
      hourRate: Number(batchForm.hourRate),
      tarimas: Number(batchForm.tarimas)
    };

    const nextBatches = [...batches, newBatch];
    setBatches(nextBatches);
    setBatchForm({ pn: '', pcsPerTarima: '', hourRate: '', tarimas: '' });
    persistAll(nextBatches, maintenanceBlocks, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart);
  };

  const removeBatch = (id) => {
    const nextBatches = batches.filter((batch) => batch.id !== id);
    setBatches(nextBatches);
    persistAll(nextBatches, maintenanceBlocks, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart);
  };

  const moveBatch = (id, direction) => {
    const currentIndex = batches.findIndex((batch) => batch.id === id);
    if (currentIndex < 0) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= batches.length) return;

    const nextBatches = [...batches];
    [nextBatches[currentIndex], nextBatches[targetIndex]] = [nextBatches[targetIndex], nextBatches[currentIndex]];

    setBatches(nextBatches);
    persistAll(nextBatches, maintenanceBlocks, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart);
  };

  const addBlock = (type) => {
    const form = type === 'programmedStop' ? programmedStopForm : type === 'plannedStop' ? plannedStopForm : blockForm;
    if (!form.dayDate || !form.time || !form.duration) return;

    const block = {
      id: Date.now(),
      dayDate: form.dayDate,
      time: form.time,
      duration: Number(form.duration),
      type
    };

    if (type === 'maintenance') {
      const nextMaintenance = [...maintenanceBlocks, block];
      setMaintenanceBlocks(nextMaintenance);
      persistAll(batches, nextMaintenance, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart);
    } else if (type === 'setup') {
      const nextSetup = [...setupBlocks, block];
      setSetupBlocks(nextSetup);
      persistAll(batches, maintenanceBlocks, nextSetup, programmedStopBlocks, plannedStopBlocks, weekStart);
    } else if (type === 'programmedStop') {
      const nextProgrammedStop = [...programmedStopBlocks, block];
      setProgrammedStopBlocks(nextProgrammedStop);
      persistAll(batches, maintenanceBlocks, setupBlocks, nextProgrammedStop, plannedStopBlocks, weekStart);
    } else {
      const nextPlannedStop = [...plannedStopBlocks, block];
      setPlannedStopBlocks(nextPlannedStop);
      persistAll(batches, maintenanceBlocks, setupBlocks, programmedStopBlocks, nextPlannedStop, weekStart);
    }
  };

  const removeBlock = (id, type) => {
    if (type === 'maintenance') {
      const nextMaintenance = maintenanceBlocks.filter((block) => block.id !== id);
      setMaintenanceBlocks(nextMaintenance);
      persistAll(batches, nextMaintenance, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart);
      return;
    }

    if (type === 'setup') {
      const nextSetup = setupBlocks.filter((block) => block.id !== id);
      setSetupBlocks(nextSetup);
      persistAll(batches, maintenanceBlocks, nextSetup, programmedStopBlocks, plannedStopBlocks, weekStart);
      return;
    }

    if (type === 'programmedStop') {
      const nextProgrammedStop = programmedStopBlocks.filter((block) => block.id !== id);
      setProgrammedStopBlocks(nextProgrammedStop);
      persistAll(batches, maintenanceBlocks, setupBlocks, nextProgrammedStop, plannedStopBlocks, weekStart);
      return;
    }

    const nextPlannedStop = plannedStopBlocks.filter((block) => block.id !== id);
    setPlannedStopBlocks(nextPlannedStop);
    persistAll(batches, maintenanceBlocks, setupBlocks, programmedStopBlocks, nextPlannedStop, weekStart);
  };

  const clearAll = async () => {
    setBatches([]);
    setMaintenanceBlocks([]);
    setSetupBlocks([]);
    setProgrammedStopBlocks([]);
    setPlannedStopBlocks([]);

    try {
      await fetch(`${API_URL}/api/heijunka/config?weekStart=${encodeURIComponent(weekStart)}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error clearing configuration:', error);
    }
  };

  const cellByIndex = useMemo(() => {
    const map = new Map();
    plan.schedule.forEach((entry) => {
      const slotIndex = weekSlots.findIndex((slot) => slot.date === entry.dayDate && slot.hour === entry.hour);
      if (slotIndex >= 0) map.set(slotIndex, entry);
    });
    return map;
  }, [plan.schedule, weekSlots]);

  if (isLoading) {
    return (
      <div className="heijunka-container">
        <div className="heijunka-loading">Cargando planeacion...</div>
      </div>
    );
  }

  return (
    <div className="heijunka-container">
      <header className="heijunka-header">
        <h1>Heijunka Semanal</h1>
        <p>Tabla de 24 horas por 7 dias. Produccion por piezas y bloqueos por tiempo.</p>
      </header>

      <section className="heijunka-toolbar">
        <div className="week-controls">
          <button type="button" onClick={() => moveWeek('prev')}>Semana anterior</button>
          <strong>{weekDays[0]?.date} al {weekDays[6]?.date}</strong>
          <button type="button" onClick={() => moveWeek('next')}>Semana siguiente</button>
          <button type="button" onClick={goToCurrentWeek}>Semana actual</button>
        </div>

        {plan.conflicts.length > 0 && (
          <div className="warning-box">
            Hay {plan.conflicts.length} conflicto(s) entre bloques en la semana.
          </div>
        )}
      </section>

      <section className="heijunka-forms">
        <article className="form-card">
          <h3>Tarimas</h3>
          <input
            type="text"
            placeholder="Numero de parte"
            value={batchForm.pn}
            onChange={(event) => setBatchForm((prev) => ({ ...prev, pn: event.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="Pcs por tarima"
            value={batchForm.pcsPerTarima}
            onChange={(event) => setBatchForm((prev) => ({ ...prev, pcsPerTarima: event.target.value }))}
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Piezas por hora"
            value={batchForm.hourRate}
            onChange={(event) => setBatchForm((prev) => ({ ...prev, hourRate: event.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="Cantidad de tarimas"
            value={batchForm.tarimas}
            onChange={(event) => setBatchForm((prev) => ({ ...prev, tarimas: event.target.value }))}
          />
          <button type="button" onClick={addBatch}>Agregar tarimas</button>
        </article>

        <article className="form-card">
          <h3>Mantenimiento / Setup</h3>
          <select
            value={blockForm.type}
            onChange={(event) => setBlockForm((prev) => ({ ...prev, type: event.target.value }))}
          >
            <option value="maintenance">Mantenimiento</option>
            <option value="setup">Setup</option>
          </select>
          <select
            value={blockForm.dayDate}
            onChange={(event) => setBlockForm((prev) => ({ ...prev, dayDate: event.target.value }))}
          >
            {weekDays.map((day) => (
              <option key={day.date} value={day.date}>{day.dayName} {day.date}</option>
            ))}
          </select>
          <select
            value={blockForm.time}
            onChange={(event) => setBlockForm((prev) => ({ ...prev, time: event.target.value }))}
          >
            {HOUR_OPTIONS.map((hourOption) => (
              <option key={hourOption.value} value={hourOption.value}>{hourOption.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="24"
            value={blockForm.duration}
            onChange={(event) => setBlockForm((prev) => ({ ...prev, duration: event.target.value }))}
          />
          <button type="button" onClick={() => addBlock(blockForm.type)}>
            {blockForm.type === 'maintenance' ? 'Agregar mantenimiento' : 'Agregar setup'}
          </button>
        </article>

        <article className="form-card">
          <h3>Paro Programado</h3>
          <select
            value={programmedStopForm.dayDate}
            onChange={(event) => setProgrammedStopForm((prev) => ({ ...prev, dayDate: event.target.value }))}
          >
            {weekDays.map((day) => (
              <option key={day.date} value={day.date}>{day.dayName} {day.date}</option>
            ))}
          </select>
          <select
            value={programmedStopForm.time}
            onChange={(event) => setProgrammedStopForm((prev) => ({ ...prev, time: event.target.value }))}
          >
            {HOUR_OPTIONS.map((hourOption) => (
              <option key={hourOption.value} value={hourOption.value}>{hourOption.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="24"
            value={programmedStopForm.duration}
            onChange={(event) => setProgrammedStopForm((prev) => ({ ...prev, duration: event.target.value }))}
          />
          <button type="button" onClick={() => addBlock('programmedStop')}>Agregar paro programado</button>
        </article>

        <article className="form-card">
          <h3>Paro No Programado</h3>
          <select
            value={plannedStopForm.dayDate}
            onChange={(event) => setPlannedStopForm((prev) => ({ ...prev, dayDate: event.target.value }))}
          >
            {weekDays.map((day) => (
              <option key={day.date} value={day.date}>{day.dayName} {day.date}</option>
            ))}
          </select>
          <select
            value={plannedStopForm.time}
            onChange={(event) => setPlannedStopForm((prev) => ({ ...prev, time: event.target.value }))}
          >
            {HOUR_OPTIONS.map((hourOption) => (
              <option key={hourOption.value} value={hourOption.value}>{hourOption.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="24"
            value={plannedStopForm.duration}
            onChange={(event) => setPlannedStopForm((prev) => ({ ...prev, duration: event.target.value }))}
          />
          <button type="button" onClick={() => addBlock('plannedStop')}>Agregar paro no programado</button>
        </article>
      </section>

      <section className="heijunka-lists">
        <article className="list-card">
          <h4>Tarimas programadas</h4>
          {plan.batchSummary.length === 0 && <p>Sin tarimas cargadas.</p>}
          {plan.batchSummary.map((batch, index) => (
            <div key={batch.id} className="list-row">
              <span>{batch.pn} — {batch.tarimas} tar × {batch.pcsPerTarima} pzs = {batch.quantity} pzs total ({batch.assignedHours} h)</span>
              <div className="list-row-actions">
                <button type="button" onClick={() => moveBatch(batch.id, -1)} disabled={index === 0}>↑</button>
                <button type="button" onClick={() => moveBatch(batch.id, 1)} disabled={index === plan.batchSummary.length - 1}>↓</button>
                <button type="button" onClick={() => removeBatch(batch.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </article>

        <article className="list-card">
          <h4>Mantenimiento / Setup</h4>
          {[...maintenanceBlocks, ...setupBlocks].length === 0 && <p>Sin bloques de mantenimiento/setup.</p>}
          {[...maintenanceBlocks, ...setupBlocks].map((block) => (
            <div key={block.id} className="list-row">
              <span>{block.type === 'maintenance' ? 'MANT' : 'SETUP'} - {block.dayDate} {block.time} ({block.duration} h)</span>
              <button type="button" onClick={() => removeBlock(block.id, block.type)}>Eliminar</button>
            </div>
          ))}
        </article>

        <article className="list-card">
          <h4>Paros Programados</h4>
          {programmedStopBlocks.length === 0 && <p>Sin paros programados.</p>}
          {programmedStopBlocks.map((block) => (
            <div key={block.id} className="list-row">
              <span>{block.dayDate} {block.time} ({block.duration} h)</span>
              <button type="button" onClick={() => removeBlock(block.id, 'programmedStop')}>Eliminar</button>
            </div>
          ))}
        </article>

        <article className="list-card">
          <h4>Paros No Programados</h4>
          {plannedStopBlocks.length === 0 && <p>Sin paros no programados.</p>}
          {plannedStopBlocks.map((block) => (
            <div key={block.id} className="list-row">
              <span>{block.dayDate} {block.time} ({block.duration} h)</span>
              <button type="button" onClick={() => removeBlock(block.id, 'plannedStop')}>Eliminar</button>
            </div>
          ))}
        </article>

        <article className="list-card">
          <h4>Acciones</h4>
          <button type="button" className="danger-button" onClick={clearAll}>Limpiar toda la semana</button>
        </article>
      </section>

      <section className="heijunka-table-wrapper">
        <table className="heijunka-table">
          <thead>
            <tr>
              <th>Hora</th>
              {weekDays.map((day) => (
                <th key={day.date}>{day.dayName}<br />{day.date}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DISPLAY_HOURS.map((displayHour) => (
              <tr key={displayHour}>
                <th>{String(displayHour).padStart(2, '0')}:00</th>
                {weekDays.map((day, dayIndex) => {
                  const calDayOffset = displayHour < DAY_START_HOUR ? 1 : 0;
                  const actualDayIndex = dayIndex + calDayOffset;
                  const slotIndex = actualDayIndex < 7 ? actualDayIndex * 24 + displayHour : -1;
                  const item = slotIndex >= 0 ? cellByIndex.get(slotIndex) : undefined;

                  return (
                    <td
                      key={`${day.date}-${displayHour}`}
                      className={item ? `cell-${item.type} ${item.type === 'production' ? `cell-production-tone-${item.batchOrder % 4}` : ''}` : 'cell-empty'}
                      title={item ? item.label : 'Libre'}
                    >
                      {item?.type === 'production' && (
                        <>
                            <strong>{item.pn}</strong>
                            <small>T{item.tarimaNumber}</small>
                            <small>Acum {Math.round(item.cumulativePieces)}/{Math.round(item.totalQuantity)} pzs</small>
                        </>
                      )}
                      {item?.type === 'maintenance' && <strong>MANT</strong>}
                      {item?.type === 'setup' && <strong>SETUP</strong>}
                      {item?.type === 'programmedStop' && <strong>PROG</strong>}
                      {item?.type === 'plannedStop' && <strong className="planned-stop-tag">PARO</strong>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default HeijunkaPage;
