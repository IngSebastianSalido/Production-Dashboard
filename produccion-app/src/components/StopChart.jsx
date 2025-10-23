import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { parseYYYYMMDD, formatYYYYMMDD } from '../utils/dateUtils';

const StopChart = ({ fecha, area }) => {
  const [chartData, setChartData] = useState(null);
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000'; // Asegúrate de que la URL sea válida

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/paros`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

  // Calcular la fecha del día siguiente para el rango de 7am a 7am usando parser seguro
  const fechaActual = parseYYYYMMDD(fecha);
  if (!fechaActual) return;
  const fechaSiguiente = new Date(fechaActual);
  fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
        
  const fechaActualStr = formatYYYYMMDD(fechaActual);
  const fechaSiguienteStr = formatYYYYMMDD(fechaSiguiente);

        // Filter rows and map into normalized records with start/end Date objects clipped to the shift window
        // Shift window: fecha 07:00 local -> fecha+1 07:00 local
        const shiftStart = new Date(fechaActual);
        shiftStart.setHours(7, 0, 0, 0);
        const shiftEnd = new Date(fechaSiguiente);
        shiftEnd.setHours(7, 0, 0, 0);

        const normalized = [];

        for (const row of data) {
          try {
            // Trim items and accept both ; and , separators
            const cols = row.map(c => (typeof c === 'string' ? c.trim() : c));
            const fechaParoRaw = cols[0];
            const areaParo = cols[1];
            const horaParoRaw = cols[4];
            const horaArranqueRaw = cols[5];
            const diferenciaRaw = cols[6];

            if (!fechaParoRaw || !horaParoRaw || !horaArranqueRaw) continue;
            if (area && areaParo !== area) continue;

            // Legacy row that stores a range like "YYYY-MM-DD a YYYY-MM-DD" in fecha column
            if (String(fechaParoRaw).includes(' a ')) {
              // In this case, repo already splits it when saved; try to handle gracefully by using the first date
              const [startDateStr] = String(fechaParoRaw).split(' a ').map(s => s.trim());
              // Build start and end using the provided times
              const startDate = parseYYYYMMDD(startDateStr);
              if (!startDate) continue;
              const [hStart, mStart] = horaParoRaw.split(':').map(Number);
              const [hEnd, mEnd] = horaArranqueRaw.split(':').map(Number);
              const paroStart = new Date(startDate);
              paroStart.setHours(hStart, isNaN(mStart) ? 0 : mStart, 0, 0);
              // end might be next day
              const paroEnd = new Date(startDate);
              paroEnd.setDate(paroEnd.getDate() + (hEnd < hStart || (hEnd === hStart && (isNaN(mEnd) ? 0 : mEnd) < (isNaN(mStart) ? 0 : mStart)) ? 1 : 0));
              paroEnd.setHours(hEnd, isNaN(mEnd) ? 0 : mEnd, 0, 0);

              normalized.push({ start: paroStart, end: paroEnd });
              continue;
            }

            // Normal case: fecha like YYYY-MM-DD
            const fechaParo = parseYYYYMMDD(String(fechaParoRaw));
            if (!fechaParo) continue;
            const [hStart, mStart] = String(horaParoRaw).split(':').map(Number);
            const [hEnd, mEnd] = String(horaArranqueRaw).split(':').map(Number);
            if (Number.isNaN(hStart) || Number.isNaN(hEnd)) continue;

            const paroStart = new Date(fechaParo);
            paroStart.setHours(hStart, isNaN(mStart) ? 0 : mStart, 0, 0);

            const paroEnd = new Date(fechaParo);
            // If end time is less or equal start, assume it crossed midnight to next day
            if (hEnd < hStart || (hEnd === hStart && (isNaN(mEnd) ? 0 : mEnd) <= (isNaN(mStart) ? 0 : mStart))) {
              paroEnd.setDate(paroEnd.getDate() + 1);
            }
            paroEnd.setHours(hEnd, isNaN(mEnd) ? 0 : mEnd, 0, 0);

            normalized.push({ start: paroStart, end: paroEnd });
          } catch (err) {
            // ignore malformed rows
            continue;
          }
        }

        // Now compute minutes of overlap between each paro and the shift window, distributed per-hour
        const hours = [];
        for (let i = 0; i < 24; i++) {
          const hora = (7 + i) % 24;
          const label = `${hora.toString().padStart(2, '0')}:00`;
          hours.push(label);
        }

        const totalMinutes = Array(24).fill(60);
        const stopMinutes = Array(24).fill(0);

        function addMinutesToHourBucket(dtStart, dtEnd) {
          // clip to shift
          const s = new Date(Math.max(dtStart.getTime(), shiftStart.getTime()));
          const e = new Date(Math.min(dtEnd.getTime(), shiftEnd.getTime()));
          if (e <= s) return; // no overlap with shift

          // iterate by hour boundaries within the shift window
          let cursor = new Date(s);
          while (cursor < e) {
            // compute current hour index in 0..23 for shift (7 -> 0)
            const hourOfDay = cursor.getHours();
            const bucketIndex = (hourOfDay - 7 + 24) % 24;

            // end of this hour (or shift end)
            const endOfHour = new Date(cursor);
            endOfHour.setMinutes(59, 59, 999);
            const segmentEnd = new Date(Math.min(endOfHour.getTime(), e.getTime()));

            const minutes = Math.ceil((segmentEnd.getTime() - cursor.getTime()) / 60000);
            if (minutes > 0 && bucketIndex >= 0 && bucketIndex < 24) {
              stopMinutes[bucketIndex] += minutes;
            }

            // move cursor to start of next minute after segmentEnd
            cursor = new Date(segmentEnd.getTime() + 1);
          }
        }

        normalized.forEach(({ start, end }) => {
          // Basic sanity: skip zero/negative length
          if (!(end > start)) return;
          addMinutesToHourBucket(start, end);
        });

        const runningMinutes = totalMinutes.map((total, i) => Math.max(0, total - Math.min(total, Math.round(stopMinutes[i]))));

        setChartData({
          labels: hours,
          datasets: [
            {
              label: 'Minutos Corriendo',
              data: runningMinutes,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              stack: 'combined',
            },
            {
              label: 'Minutos en Paro',
              data: stopMinutes,
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              stack: 'combined',
            },
          ],
        });
      } catch (error) {
        console.error('Error fetching stop data:', error.message);
      }
    };

    if (fecha) {
      fetchData();
    }
  }, [fecha, area, serverApiUrl]);

  if (!chartData) {
    return <div>Cargando datos...</div>;
  }

  return (
    <div>
      <h2>
        Minutos de Paro por Hora (Turno 7am-7am)
        {area && ` - Área: ${area}`}
      </h2>
      <Bar
        data={chartData}
        options={{
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, max: 60 },
          },
        }}
      />
    </div>
  );
};

export default StopChart;