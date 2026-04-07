/**
 * Heijunka scheduling utility functions
 * Simplified model: current week table (7 days x 24 hours).
 */

const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const TOTAL_WEEK_SLOTS = HOURS_PER_DAY * DAYS_PER_WEEK;
export const DAY_START_HOUR = 7;

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

const toDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr) => {
  const parts = dateStr.split('-').map(x => parseInt(x, 10));
  if (parts.length !== 3) return new Date();
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

const addDays = (dateStr, daysToAdd) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  return toDateOnly(d);
};

const parseHour = (time) => {
  if (!time || typeof time !== 'string') return 0;
  const hour = Number.parseInt(time.split(':')[0], 10);
  return Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0;
};

const parsePositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed > 0 ? parsed : fallback;
};

export const formatHour = (hour) => `${String(hour).padStart(2, '0')}:00`;

export const calculateBatchTime = (quantity, hourRate) => {
  const qty = parsePositiveNumber(quantity, 0);
  const rate = parsePositiveNumber(hourRate, 0);
  if (rate === 0) return 0;
  return qty / rate;
};

export const getWeekDays = (weekStart) => {
  return Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
    const date = addDays(weekStart, dayIndex);
    return {
      dayIndex,
      dayName: DAY_NAMES_ES[dayIndex],
      date
    };
  });
};

export const buildWeekSlots = (weekStart) => {
  const days = getWeekDays(weekStart);

  return Array.from({ length: TOTAL_WEEK_SLOTS }, (_, slotIndex) => {
    const dayIndex = Math.floor(slotIndex / HOURS_PER_DAY);
    const hour = slotIndex % HOURS_PER_DAY;
    const day = days[dayIndex];

    return {
      slotIndex,
      dayIndex,
      dayName: day.dayName,
      date: day.date,
      hour,
      hourLabel: formatHour(hour)
    };
  });
};

const slotIndexForDateHour = (date, hour, weekStart) => {
  const start = parseLocalDate(weekStart);
  const target = parseLocalDate(date);
  const dayOffset = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (dayOffset < 0 || dayOffset >= DAYS_PER_WEEK) return -1;
  return dayOffset * HOURS_PER_DAY + hour;
};

const applyTimeBlocks = (slotMap, blocks, weekStart, kind, conflicts) => {
  blocks.forEach((block) => {
    const startHour = parseHour(block.time);
    const duration = Math.max(1, Math.round(parsePositiveNumber(block.duration, 1)));
    const date = block.dayDate || weekStart;

    // Hours before DAY_START_HOUR belong to the next calendar day in the 7am-7am model
    const adjustedDate = startHour < DAY_START_HOUR ? addDays(date, 1) : date;

    // Find the starting slot index
    const startSlotIndex = slotIndexForDateHour(adjustedDate, startHour, weekStart);
    if (startSlotIndex < 0) return; // Block starts outside the week

    // Fill slots from startSlotIndex forward
    for (let step = 0; step < duration; step += 1) {
      const slotIndex = startSlotIndex + step;

      // Stop if we go beyond the week
      if (slotIndex >= TOTAL_WEEK_SLOTS) break;

      if (slotMap[slotIndex]) {
        conflicts.push({
          slotIndex,
          currentType: slotMap[slotIndex].type,
          incomingType: kind,
          incomingId: block.id
        });
        continue;
      }

      slotMap[slotIndex] = {
        type: kind,
        id: block.id,
        duration,
        label: kind === 'maintenance'
          ? 'Mantenimiento'
          : kind === 'setup'
            ? 'Setup'
            : kind === 'programmedStop'
              ? 'Paro Prog.'
              : 'Paro No Prog.',
        startTime: block.time
      };
    }
  });
};

export const generateWeeklyPlan = (batches, maintenanceBlocks, setupBlocks, programmedStopBlocks, plannedStopBlocks, weekStart) => {
  const weekSlots = buildWeekSlots(weekStart);
  const slotMap = Array.from({ length: TOTAL_WEEK_SLOTS }, () => null);
  const conflicts = [];

  applyTimeBlocks(slotMap, maintenanceBlocks || [], weekStart, 'maintenance', conflicts);
  applyTimeBlocks(slotMap, setupBlocks || [], weekStart, 'setup', conflicts);
  applyTimeBlocks(slotMap, programmedStopBlocks || [], weekStart, 'programmedStop', conflicts);
  applyTimeBlocks(slotMap, plannedStopBlocks || [], weekStart, 'plannedStop', conflicts);

  const batchSummary = [];
  let cursor = DAY_START_HOUR;

  (batches || []).forEach((batch, batchOrder) => {
    const pcsPerTarima = parsePositiveNumber(batch.pcsPerTarima, 0);
    const tarimasCount = parsePositiveNumber(batch.tarimas, 1);
    // backward compat: old batches had a flat `quantity` field
    const qty = pcsPerTarima > 0 ? pcsPerTarima * tarimasCount : parsePositiveNumber(batch.quantity, 0);
    const effectivePcsPerTarima = pcsPerTarima > 0 ? pcsPerTarima : qty;
    const rate = parsePositiveNumber(batch.hourRate, 0);
    const requiredHours = rate > 0 ? qty / rate : 0;

    let piecesRemaining = qty;
    let piecesCompleted = 0;
    let assignedHours = 0;

    while (piecesRemaining > 0 && cursor < TOTAL_WEEK_SLOTS) {
      if (!slotMap[cursor]) {
        const producedPieces = Math.min(piecesRemaining, rate);
        const tarimaNumber = effectivePcsPerTarima > 0
          ? Math.floor(piecesCompleted / effectivePcsPerTarima) + 1
          : 1;
        piecesCompleted += producedPieces;
        piecesRemaining -= producedPieces;
        assignedHours += 1;

        slotMap[cursor] = {
          type: 'production',
          batchId: batch.id,
          batchOrder,
          pn: batch.pn,
          totalQuantity: qty,
          pcsPerTarima: effectivePcsPerTarima,
          tarimasCount,
          tarimaNumber,
          producedPieces,
          cumulativePieces: piecesCompleted,
          hourRate: rate,
          label: `${batch.pn} - Tarima ${tarimaNumber}`
        };
      }

      cursor += 1;
    }

    batchSummary.push({
      id: batch.id,
      pn: batch.pn,
      quantity: qty,
      pcsPerTarima: effectivePcsPerTarima,
      tarimas: tarimasCount,
      hourRate: rate,
      requiredHours,
      assignedHours,
      programmedPieces: qty - piecesRemaining,
      pendingPieces: piecesRemaining,
      completed: piecesRemaining <= 0
    });
  });

  const schedule = weekSlots
    .map((slot) => {
      const item = slotMap[slot.slotIndex];
      if (!item) return null;

      return {
        id: `${slot.date}-${slot.hour}-${item.type}`,
        dayDate: slot.date,
        dayName: slot.dayName,
        hour: slot.hour,
        hourLabel: slot.hourLabel,
        ...item
      };
    })
    .filter(Boolean);

  return {
    weekSlots,
    slotMap,
    schedule,
    batchSummary,
    conflicts
  };
};

/**
 * Compatibility helper used by legacy tests or scripts.
 */
export const generateSchedule = (
  batches,
  maintenanceBlocks,
  setupBlocks,
  weekStart,
  plannedStopBlocks = [],
  programmedStopBlocks = []
) => {
  return generateWeeklyPlan(
    batches,
    maintenanceBlocks,
    setupBlocks,
    programmedStopBlocks,
    plannedStopBlocks,
    weekStart
  ).schedule;
};

/**
 * Compatibility helper for older scripts.
 */
export const getScheduleWithTiming = (batches, maintenanceBlocks, setupBlocks, weekStart) => {
  return generateWeeklyPlan(batches, maintenanceBlocks, setupBlocks, [], [], weekStart).batchSummary;
};

/**
 * Legacy helpers preserved for compatibility.
 */
export const getTimelineIndex = (hour) => hour;

export const getActualHour = (timelineIndex) => timelineIndex;

/**
 * Check if a same-day time slot is available in the provided blocks.
 */
export const isTimeSlotAvailable = (hour, duration, maintenanceBlocks, setupBlocks) => {
  const blockedHours = new Set();

  (maintenanceBlocks || []).forEach((maint) => {
    const startHour = parseHour(maint.time);
    const safeDuration = Math.max(1, Math.round(parsePositiveNumber(maint.duration, 1)));
    for (let i = 0; i < safeDuration; i += 1) {
      blockedHours.add((startHour + i) % HOURS_PER_DAY);
    }
  });

  (setupBlocks || []).forEach((setup) => {
    const startHour = parseHour(setup.time);
    const safeDuration = Math.max(1, Math.round(parsePositiveNumber(setup.duration, 1)));
    for (let i = 0; i < safeDuration; i += 1) {
      blockedHours.add((startHour + i) % HOURS_PER_DAY);
    }
  });

  const safeDuration = Math.max(1, Math.round(parsePositiveNumber(duration, 1)));
  for (let i = 0; i < safeDuration; i += 1) {
    if (blockedHours.has((hour + i) % HOURS_PER_DAY)) {
      return false;
    }
  }

  return true;
};
