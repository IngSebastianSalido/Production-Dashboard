import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const REAChart = ({ fecha }) => {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const backendUrl = import.meta.env.VITE_SERVER_API_URL || "http://localhost:3000";

  const formatearFecha = (fechaIso) => {
    const partes = fechaIso.split("-");
    const year = partes[0];
    const month = parseInt(partes[1], 10);
    const day = parseInt(partes[2], 10);
    return `${month}/${day}/${year}`;
  };

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const fechaFormateada = formatearFecha(fecha);
        const response = await fetch(`${backendUrl}/api/rea-production-eolo-graph?fecha=${fechaFormateada}`);
        const result = await response.json();
        setDatos(result);
      } catch (error) {
        console.error("Error al obtener producción por hora:", error);
      } finally {
        setCargando(false);
      }
    };

    if (fecha) {
      obtenerDatos();
    }
  }, [fecha]);

  if (cargando) {
    return <p>Cargando producción por hora...</p>;
  }

  return (
    <div style={{ width: "100%", height: 400 }}>
      <h2>Producción EOLOk Acumulada por hora - {fecha}</h2>
      <ResponsiveContainer>
        <BarChart data={datos}>
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
  );
};

export default REAChart;
