    import React from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

const StationStopChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>No hay datos para mostrar</div>;
  }

  // Preparar datos para la gráfica
  const estaciones = data.map(item => item.estacion);
  const tiempos = data.map(item => item.tiempoTotal);

  const chartData = {
    labels: estaciones,
    datasets: [
      {
        label: 'Tiempo de Paro (minutos)',
        data: tiempos,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: true,
        text: 'Tiempo Acumulado de Paros por Estación',
        font: {
          size: 18
        }
      },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const index = context.dataIndex;
            const cantidadParos = data[index].cantidadParos;
            return `Cantidad de paros: ${cantidadParos}`;
          },
          label: function(context) {
            const minutos = context.parsed.y;
            const horas = Math.floor(minutos / 60);
            const mins = minutos % 60;
            return `Tiempo total: ${horas}h ${mins}m (${minutos} min)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Minutos'
        },
        ticks: {
          callback: function(value) {
            const horas = Math.floor(value / 60);
            const mins = value % 60;
            if (horas > 0) {
              return `${horas}h ${mins}m`;
            }
            return `${mins}m`;
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Estaciones'
        },
        ticks: {
          autoSkip: false,
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  return (
    <div style={{ height: '500px', width: '100%', padding: '20px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default StationStopChart;
