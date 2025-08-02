import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import Modal from './Modal';
import './Chart1.css'; // Reutilizamos los estilos de Chart1
import { getDefectsData } from '../api/mockData';

const Chart3 = ({ mesSeleccionado }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState(['Ajuste Incorrecto', 'Material Defectuoso', 'Error de Operador', 'Falla de Máquina', 'Otros']);
  const [defectValues, setDefectValues] = useState([45, 25, 15, 10, 5]);
  
  // Cargar datos del API
  useEffect(() => {
    setLoading(true);
    getDefectsData(mesSeleccionado) // Usar directamente el mes seleccionado
      .then(data => {
        setCategories(data.categories);
        setDefectValues(data.defectValues);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error al cargar datos de defectos:", error);
        setLoading(false);
      });
  }, [mesSeleccionado]);
  
  // Calcular totales para la información detallada
  const totalDefects = defectValues.reduce((a, b) => a + b, 0);
  
  // Datos para la gráfica
  const chartData = {
    labels: categories,
    datasets: [
      {
        label: 'Causas de Defectos',
        data: defectValues,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }
    ]
  };
  
  // Opciones comunes para los gráficos
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { 
          color: 'white',
          font: { size: 12 }
        },
        position: 'right'
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const percentage = ((value / totalDefects) * 100).toFixed(1);
            return `${context.label}: ${value} (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: 'Análisis de Causas de Defectos',
        color: 'white',
        font: { size: 14 }
      }
    }
  };

  return (
    <>
      <div className="chart-card" onClick={() => setModalOpen(true)}>
        <h3>Causas de Defectos</h3>
        
        {loading ? (
          <div className="chart-loading">
            <div className="chart-loading-spinner"></div>
            <p>Cargando datos...</p>
          </div>
        ) : (
          <>
            <div className="chart-container">
              <Pie
                data={chartData}
                options={chartOptions}
              />
            </div>
            <div className="data-grid-mini">
              <div className="mini-summary">
                <p>Total defectos: {totalDefects}</p>
                <p>Click para ver detalles</p>
              </div>
            </div>
          </>
        )}
      </div>
      
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title="Análisis de Causas de Defectos"
      >
        <div className="modal-chart-container">
          <Pie
            data={chartData}
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                legend: {
                  ...chartOptions.plugins.legend,
                  position: 'bottom'
                }
              }
            }}
          />
        </div>        <div className="chart-details">
          <p>Mes: {mesSeleccionado}</p>
          <h4>Análisis Detallado de Defectos</h4>
          {categories.map((label, index) => {
            const value = defectValues[index];
            const percentage = ((value / totalDefects) * 100).toFixed(1);
            return (
              <p key={index}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '12px', 
                  height: '12px',
                  backgroundColor: chartData.datasets[0].backgroundColor[index],
                  marginRight: '8px'
                }}></span>
                {label}: {value} ({percentage}%)
              </p>
            );
          })}
          <p>Total: {totalDefects} defectos</p>
          
          <h4>Acciones Recomendadas</h4>
          <p>• Revisar procedimiento de ajuste en máquinas (principal causa de defectos)</p>
          <p>• Evaluar calidad de proveedores de material</p>
          <p>• Realizar entrenamiento adicional a operadores</p>
        </div>
      </Modal>
    </>
  );
};

export default Chart3;
