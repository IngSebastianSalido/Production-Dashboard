import React, { useEffect, useState } from "react";
import "../REA.css";
import REAChart from "../components/REAChart";
import StationsGrid from "../components/StationsGrid";

const REA = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🔥 Inicializar la fecha seleccionada con la fecha de hoy
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // formato "YYYY-MM-DD" que acepta <input type="date">
  };

  const [fechaSeleccionada, setFechaSeleccionada] = useState(getTodayDate());

  const backendUrl = import.meta.env.VITE_SERVER_API_URL || "http://localhost:3000";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/rea-production`);
        const result = await response.json();
        setData(result);

        // 🔥 OPCIONAL: si quieres sobreescribir la fecha solo si quieres basarla en datos
        // if (result.length > 0) {
        //   setFechaSeleccionada(result[0].fecha);
        // }
      } catch (error) {
        console.error("Error al obtener los datos de REA:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <p className="rea-loading">Cargando datos...</p>;
  }

  return (
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">REA - Análisis de Producción</h1>
        <p className="page-subtitle">Monitoreo de estaciones y producción en tiempo real</p>
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
        <div className="panel-header">
          <h2>Gráfico de Producción</h2>
        </div>
        {fechaSeleccionada && <REAChart fecha={fechaSeleccionada} />}
      </div>

      {data.map((entry, index) => (
        <div key={index} className="panel" style={{ marginTop: "20px" }}>
          <div className="panel-header">
            <h2>Fecha: {entry.fecha} | Hora: {entry.hora}</h2>
          </div>
          <div style={{ padding: '15px 0' }}>
            <p style={{ fontSize: '16px', color: '#aaa', marginBottom: '15px' }}>
              <strong>Número de Parte:</strong> {entry.pn}
            </p>
            <StationsGrid estaciones={entry.estaciones} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default REA;
