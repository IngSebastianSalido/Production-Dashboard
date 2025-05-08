import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const REAChart = ({ fecha }) => {
  const [datos, setDatos] = useState([]);
  const [turnos, setTurnos] = useState({ turno1: 0, turno2: 0, turno3: 0 });
  const [cargando, setCargando] = useState(true);

  const backendUrl = import.meta.env.VITE_SERVER_API_URL || "http://localhost:3000";

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/rea-production-eolo-graph?fecha=${fecha}`);
        const result = await response.json();
        // Asumir que el resultado tiene { datos, turnos }
        setDatos(result.datos);
        setTurnos(result.turnos);
      } catch (error) {
        console.error("Error al obtener producción por hora:", error);
      } finally {
        setCargando(false);
      }
    };

    if (fecha) {
      obtenerDatos();
    }
  }, [fecha, backendUrl]);

  if (cargando) {
    return <p>Cargando producción por hora...</p>;
  }

  return (
    <div style={{ width: "100%", height: "500px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Producción EOLOk Acumulada por hora - {fecha}</h2>
      <div className="turnos-encabezado" style={{ display: "flex", justifyContent: "space-around", marginBottom: "20px", fontWeight: "bold", fontSize: "1.2rem" }}>
        <p>Turno 1 (07:00-15:00): {turnos.turno1}</p>
        <p>Turno 2 (15:00-22:30): {turnos.turno2}</p>
        <p>Turno 3 (22:30-07:00): {turnos.turno3}</p>
      </div>
      <div style={{ width: "100%", height: "350px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hora" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="piezasProducidas">
              {datos.map((entry, index) => {
                let fillColor = "#ff0000"; // 🔴 Default rojo
                if (entry.piezasProducidas >= 160) {
                  fillColor = "#00cc00"; // 🟢 Verde
                } else if (entry.piezasProducidas >= 142) {
                  fillColor = "#ffd700"; // 🟡 Amarillo
                }
                return <Cell key={`cell-${index}`} fill={fillColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default REAChart;
