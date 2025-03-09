import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

const StopChart = ({ fecha }) => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_API_URL}/api/paros`);
        const data = await response.json();

        const filteredData = data.filter(paro => paro[0] === fecha);

        const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        const totalMinutes = Array(24).fill(60);
        const stopMinutes = Array(24).fill(0);

        filteredData.forEach(paro => {
          const horaParo = new Date(`1970-01-01T${paro[4]}:00Z`);
          const horaArranque = new Date(`1970-01-01T${paro[5]}:00Z`);
          const diferenciaMinutos = parseInt(paro[6], 10);

          let currentHour = horaParo.getHours();
          let remainingMinutes = diferenciaMinutos;

          while (remainingMinutes > 0) {
            const nextHour = (currentHour + 1) % 24;
            const minutesInCurrentHour = Math.min(remainingMinutes, 60 - horaParo.getMinutes());
            stopMinutes[nextHour] += minutesInCurrentHour;
            remainingMinutes -= minutesInCurrentHour;
            horaParo.setHours(nextHour, 0, 0, 0);
            currentHour = nextHour;
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
        console.error('Error fetching stop data:', error);
      }
    };

    if (fecha) {
      fetchData();
    }
  }, [fecha]);

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
            x: {
              stacked: true,
            },
            y: {
              stacked: true,
              beginAtZero: true,
              max: 60,
            },
          },
        }}
      />
    </div>
  );
};

export default StopChart;