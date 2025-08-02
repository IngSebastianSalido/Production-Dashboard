import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import Modal from './Modal';
import './Chart1.css'; // Reutilizamos los estilos de Chart1
import { getCycleTimeData } from '../api/mockData';

const Chart2 = ({ mesSeleccionado }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cycleTimeData, setCycleTimeData] = useState([145, 152, 138, 142, 149, 135, 140]);
  const [targetTimeData, setTargetTimeData] = useState(Array(7).fill(140));
  
  // Cargar datos del API
  useEffect(() => {
    setLoading(true);
    getCycleTimeData(mesSeleccionado) // Usar directamente el mes seleccionado
      .then(data => {
        setCycleTimeData(data.cycleTimeData);
        setTargetTimeData(Array(7).fill(data.targetTime));
        setLoading(false);
      })
      .catch(error => {
        console.error("Error al cargar datos de tiempo de ciclo:", error);
        setLoading(false);
      });
  }, [mesSeleccionado]);
  
  // Generar etiquetas para los últimos 7 días
  const generateLastSevenDays = () => {
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayNumber = day.getDate();
      const dayName = dayNames[day.getDay()];
      days.push(`${dayName} ${dayNumber}`);
    }
    return days;
  };
  
  const days = generateLastSevenDays();
  
  // Calcular promedio y desviaciones
  const averageCycleTime = (cycleTimeData.reduce((a, b) => a + b, 0) / cycleTimeData.length).toFixed(2);
  const minCycleTime = Math.min(...cycleTimeData);
  const maxCycleTime = Math.max(...cycleTimeData);
  const targetTime = targetTimeData[0];
  
  // Datos para la gráfica
  const chartData = {
    labels: days,
    datasets: [
      {
        label: 'Tiempo de Ciclo (seg)',
        data: cycleTimeData,
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        borderColor: 'rgba(53, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Tiempo Objetivo',
        data: targetTimeData,
        backgroundColor: 'transparent',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointStyle: false,
      }
    ],
  };
  
  // Opciones comunes para los gráficos
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: 'white',
    scales: {
      y: {
        beginAtZero: false,
        ticks: { 
          color: 'white',
          callback: function(value) {
            return value + 's';
          }
        },
        title: {
          display: true,
          text: 'Tiempo (segundos)',
          color: 'white'
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      x: {
        ticks: { color: 'white' },
        title: {
          display: true,
          text: 'Día del mes',
          color: 'white'
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    },
    plugins: {
      legend: {
        labels: { color: 'white' }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.raw}s`;
          }
        }
      }
    }
  };

  return (
    <>
      <div className="chart-card" onClick={() => setModalOpen(true)}>
        <h3>Tiempo de Ciclo</h3>
        
        {loading ? (
          <div className="chart-loading">
            <div className="chart-loading-spinner"></div>
            <p>Cargando datos...</p>
          </div>
        ) : (
          <>
            <div className="chart-container">
              <Line
                data={chartData}
                options={chartOptions}
              />
            </div>
            <div className="data-grid-mini">
              <div className="mini-summary">
                <p>Promedio: {averageCycleTime}s</p>
                <p>Click para ver detalles</p>
              </div>
            </div>
          </>
        )}
      </div>
      
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title="Análisis de Tiempo de Ciclo"
      >
        <div className="modal-chart-container">
          <Line
            data={chartData}
            options={chartOptions}
          />
        </div>        <div className="chart-details">
          <p>Mes: {mesSeleccionado}</p>
          <h4>Información Detallada</h4>
          <p>Tiempo de ciclo promedio: {averageCycleTime}s</p>
          <p>Tiempo objetivo: {targetTime}s</p>
          <p>Desviación máxima: {Math.abs(maxCycleTime - targetTime).toFixed(2)}s ({maxCycleTime > targetTime ? 'por encima' : 'por debajo'} del objetivo)</p>
          <p>Mejor tiempo registrado: {minCycleTime}s</p>
          <p>Días por encima del objetivo: {cycleTimeData.filter(time => time > targetTime).length}</p>
          <p>Días dentro del objetivo: {cycleTimeData.filter(time => time <= targetTime).length}</p>
        </div>
      </Modal>
    </>
  );
};

export default Chart2;
