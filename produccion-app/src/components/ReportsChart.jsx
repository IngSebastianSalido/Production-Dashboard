import React from 'react';
import { Bar } from 'react-chartjs-2';

const ReportsChart = ({ data, view = 'Totals' }) => {
  const labels = data.map(d => d.machine);

  let chartData;
  let options;

  if (view === 'Scrap Percentage') {
    const perc = data.map(d => {
      const total = (d.ok || 0) + (d.nok || 0);
      return total > 0 ? (d.nok / total) * 100 : 0;
    });

    // Ajuste dinámico de escala para valores pequeños
    const maxPerc = Math.max(0, ...perc);
    const bounds = [5, 10, 20, 30, 50, 100];
    const suggestedMax = bounds.find(b => maxPerc <= b) || 100;
    const stepSize = suggestedMax <= 10 ? 1 : suggestedMax <= 20 ? 2 : suggestedMax <= 50 ? 5 : 10;

    chartData = {
      labels,
      datasets: [
        {
          label: 'Scrap %',
          data: perc,
          backgroundColor: 'rgba(255,159,64,0.6)',
        },
      ],
    };

    options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Scrap Percentage' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw?.toFixed(2)}%`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: suggestedMax,
          ticks: {
            stepSize,
            callback: value => `${value}%`,
          },
        },
      },
    };
  } else {
    const ok = data.map(d => d.ok);
    const nok = data.map(d => d.nok);

    chartData = {
      labels,
      datasets: [
        { label: 'OK', data: ok, backgroundColor: 'rgba(75,192,192,0.6)' },
        { label: 'NOK', data: nok, backgroundColor: 'rgba(255,99,132,0.6)' },
      ],
    };

    options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Totals' },
      },
      scales: { y: { beginAtZero: true } },
    };
  }

  return (
    <div style={{ height: 360 }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default ReportsChart;
