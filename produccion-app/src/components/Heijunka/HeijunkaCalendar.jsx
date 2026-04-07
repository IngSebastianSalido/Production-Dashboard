import React, { useState } from 'react';
import './HeijunkaCalendar.css';

const HeijunkaCalendar = ({ schedule, batches, maintenanceBlocks, setupBlocks, selectedDay, weekStart, onSelectDay, onChangeWeek, onGoToCurrentWeek, onExportCSV }) => {
  const HOURS = Array.from({ length: 24 }, (_, i) => {
    const hour = (7 + i) % 24;
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`
    };
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const baseDate = new Date(weekStart + 'T00:00:00');

  const weekDays = days.map((day, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return {
      name: day,
      date: date.toISOString().split('T')[0],
      dateObj: date
    };
  });

  const getScheduleItemsForTimeSlot = (dayDate, hourIndex) => {
    // Las horas después de medianoche (indices 17-23 = 00:00-06:00) pertenecen al día siguiente
    const actualHour = (7 + hourIndex) % 24;
    let targetDate = dayDate;
    
    // Si la hora actual es menor que 7 (00:00-06:00), estamos en el día siguiente
    if (actualHour < 7 && hourIndex >= 17) {
      const nextDay = new Date(dayDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      targetDate = nextDay.toISOString().split('T')[0];
    }
    
    return schedule.filter(item => {
      if (item.dayDate !== targetDate) return false;
      return item.startHour <= hourIndex && item.endHour > hourIndex;
    });
  };

  const hourIndexToActual = (idx) => (7 + idx) % 24;

  const getMaintenance = (dayDate, hourIndex) => {
    const actualHour = hourIndexToActual(hourIndex);
    let targetDate = dayDate;
    
    // Si la hora actual es menor que 7 (00:00-06:00), estamos en el día siguiente
    if (actualHour < 7 && hourIndex >= 17) {
      const nextDay = new Date(dayDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      targetDate = nextDay.toISOString().split('T')[0];
    }
    
    return maintenanceBlocks.filter(m => {
      if (m.dayDate !== targetDate) return false;
      const startHour = parseInt(m.time.split(':')[0], 10);
      return startHour <= actualHour && startHour + m.duration > actualHour;
    });
  };

  const getSetup = (dayDate, hourIndex) => {
    const actualHour = hourIndexToActual(hourIndex);
    let targetDate = dayDate;
    
    // Si la hora actual es menor que 7 (00:00-06:00), estamos en el día siguiente
    if (actualHour < 7 && hourIndex >= 17) {
      const nextDay = new Date(dayDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      targetDate = nextDay.toISOString().split('T')[0];
    }
    
    return setupBlocks.filter(s => {
      if (s.dayDate !== targetDate) return false;
      const startHour = parseInt(s.time.split(':')[0], 10);
      return startHour <= actualHour && startHour + s.duration > actualHour;
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatWeekRange = () => {
    const startDate = new Date(weekStart + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="heijunka-calendar">
      <div className="calendar-header">
        <div className="header-top">
          <h2>Production Schedule (7am - 7am Next Day)</h2>
          <div className="header-controls">
            <button className="export-btn" onClick={onExportCSV} title="Export to CSV">
              <span>📊</span> Export CSV
            </button>
          </div>
        </div>
        
        <div className="week-navigation">
          <button className="week-nav-btn" onClick={() => onChangeWeek('prev')} title="Previous Week">
            ◀ Previous
          </button>
          <div className="week-display">
            <div className="week-label">Week:</div>
            <div className="week-range">{formatWeekRange()}</div>
          </div>
          <button className="week-nav-btn current-week-btn" onClick={onGoToCurrentWeek} title="Go to Current Week">
            📅 Today
          </button>
          <button className="week-nav-btn" onClick={() => onChangeWeek('next')} title="Next Week">
            Next ▶
          </button>
        </div>

        <div className="week-selector">
          {weekDays.map((day, idx) => (
            <div
              key={idx}
              className={`day-button read-only ${selectedDay === day.date ? 'active' : ''}`}
              title="Vista semanal (solo lectura)"
            >
              <span className="day-name">{day.name}</span>
              <span className="day-date">{formatDate(day.date)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-wrapper">
        <div className="hours-column">
          <div className="hour-header-label"></div>
          {HOURS.map((h, idx) => (
            <div key={idx} className="hour-cell">
              {h.label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {weekDays.map((day, dayIdx) => (
            <div key={dayIdx} className="day-column">
              <div className="day-header">
                <div className="day-title">{day.name}</div>
                <div className="day-date-full">{formatDate(day.date)}</div>
              </div>

              {HOURS.map((h, hourIdx) => {
                const scheduleItems = getScheduleItemsForTimeSlot(day.date, hourIdx);
                const maintenanceItems = getMaintenance(day.date, hourIdx);
                const setupItems = getSetup(day.date, hourIdx);

                const slotClasses = [
                  'hour-slot',
                  maintenanceItems.length ? 'has-maintenance' : '',
                  setupItems.length ? 'has-setup' : ''
                ].filter(Boolean).join(' ');

                return (
                  <div key={hourIdx} className={slotClasses}>
                    {setupItems.length > 0 && (
                      <div className="setup-block">
                        <div className="block-label">SETUP</div>
                        <div className="block-duration">{setupItems[0].duration}h</div>
                      </div>
                    )}

                    {maintenanceItems.length > 0 && (
                      <div className="maintenance-block">
                        <div className="block-label">MAINT.</div>
                        <div className="block-duration">{maintenanceItems[0].duration}h</div>
                      </div>
                    )}

                    {scheduleItems.map((item, idx) => {
                      // Determinar si es el último slot de este batch en este día
                      const isLastInDay = hourIdx === 23 || !getScheduleItemsForTimeSlot(day.date, hourIdx + 1).some(i => i.batchId === item.batchId);
                      
                      return (
                        <div key={idx} className="schedule-item">
                          <div className="item-pn">{item.pn}</div>
                          <div className="item-qty">{item.quantity} pcs</div>
                          {isLastInDay && item.continuesNextDay && (
                            <div className="item-time">→ continues</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-color schedule-item"></div>
          <span>Production Batch</span>
        </div>
        <div className="legend-item">
          <div className="legend-color maintenance-block"></div>
          <span>Maintenance</span>
        </div>
        <div className="legend-item">
          <div className="legend-color setup-block"></div>
          <span>Setup/Tooling</span>
        </div>
      </div>
    </div>
  );
};

export default HeijunkaCalendar;
