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
    <div className="rea-container">
      <h1 className="rea-title">REA</h1>

      <div className="rea-date-picker" style={{ marginBottom: "40px" }}> {/* Espaciado adicional */}
        <label htmlFor="fecha">Seleccionar fecha: </label>
        <input
          type="date"
          id="fecha"
          value={fechaSeleccionada}
          onChange={(e) => setFechaSeleccionada(e.target.value)}
        />
      </div>

      <div className="rea-chart-full" style={{ marginBottom: "60px" }}> {/* Espaciado adicional */}
        {fechaSeleccionada && <REAChart fecha={fechaSeleccionada} />}
      </div>

      {data.map((entry, index) => (
        <div key={index} className="rea-entry" style={{ marginBottom: "50px" }}> {/* Espaciado adicional */}
          <h2 className="rea-date">Fecha: {entry.fecha}</h2>
          <h3 className="rea-time">Hora: {entry.hora}</h3>

          <StationsGrid estaciones={entry.estaciones} />
        </div>
      ))}
    </div>
  );
};

export default REA;
