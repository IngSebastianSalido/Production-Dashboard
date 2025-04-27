import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

const StopChart = ({ fecha }) => {
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

        const filteredData = data.filter(paro => paro[0] === fecha);

        const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        const totalMinutes = Array(24).fill(60);
        const stopMinutes = Array(24).fill(0);

        filteredData.forEach(paro => {
          let horaParo = new Date(`1970-01-01T${paro[4]}:00Z`);
          const diferenciaMinutos = parseInt(paro[6], 10);
          let remainingMinutes = diferenciaMinutos;

          while (remainingMinutes > 0) {
            const currentHour = horaParo.getUTCHours();
            const currentMinute = horaParo.getUTCMinutes();
            const availableMinutesInHour = 60 - currentMinute;
            const minutesToAdd = Math.min(availableMinutesInHour, remainingMinutes);

            stopMinutes[currentHour] += minutesToAdd;
            remainingMinutes -= minutesToAdd;

            horaParo.setUTCMinutes(horaParo.getUTCMinutes() + minutesToAdd);
          }
        });

        const runningMinutes = totalMinutes.map((total, i) => total - stopMinutes[i]);

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
  }, [fecha, serverApiUrl]);

  if (!chartData) {
    return <div>Cargando datos...</div>;
  }

  return (
    <div>
      <h2>Minutos de Paro por Hora</h2>
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