import React, { useEffect, useState } from "react";
import "../REA.css"; // Archivo CSS específico para la página REA

const REA = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Obtener la URL del backend desde las variables de entorno
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  useEffect(() => {
    // Llamar al endpoint para obtener los datos de producción REA
    const fetchData = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/rea-production`);
        const result = await response.json();
        setData(result);
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
      {data.map((entry, index) => (
        <div key={index} className="rea-entry">
          <h2 className="rea-date">Fecha: {entry.fecha}</h2>
          <h3 className="rea-time">Hora: {entry.hora}</h3>
          <div className="rea-stations-row">
            {entry.estaciones.map((station, stationIndex) => (
              <div
                key={stationIndex}
                className={`rea-station-card ${
                  station.percent >= 95
                    ? "green"
                    : station.percent >= 90
                    ? "yellow"
                    : "red"
                }`}
              >
                <h4 className="rea-station-name">{station.station}</h4>
                <div className="rea-station-metrics">
                  <div className="rea-metric">OK: {station.ok}</div>
                  <div className="rea-metric">NOK: {station.nok}</div>
                  <div className="rea-metric">{station.percent.toFixed(2)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default REA;