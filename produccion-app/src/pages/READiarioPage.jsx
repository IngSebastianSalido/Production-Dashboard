import React, { useState } from "react";
import "../REA.css";
import READiarioChart from "../components/READiarioChart";

const READiarioPage = () => {
  // 🔥 Inicializar la fecha seleccionada con la fecha de hoy
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // formato "YYYY-MM-DD"
  };

  const [fechaSeleccionada, setFechaSeleccionada] = useState(getTodayDate());

  return (
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">REA Diario - Análisis de Producción</h1>
        <p className="page-subtitle">Tendencia de producción esperada vs. real + Resumen de paros</p>
      </div>

      <div className="panel">
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="fecha">Seleccionar fecha:</label>
            <input
              type="date"
              id="fecha"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        {fechaSeleccionada && <READiarioChart fecha={fechaSeleccionada} />}
      </div>
    </div>
  );
};

export default READiarioPage;
