import React, { useState } from "react";
import axios from "axios";
import styles from "../ReportTable.module.css";

const ReportTable = () => {
  const [fecha, setFecha] = useState("");
  const [area, setArea] = useState("");
  const [reportes, setReportes] = useState([]);

  const handleSearch = async () => {
    try {
      const response = await axios.get(
        `http://192.168.68.165:3000/api/reportes/${fecha}/${area}`
      );
      const sortedReportes = response.data.sort((a, b) => {
        const horaA = a[3]; // La columna de la hora en los datos
        const horaB = b[3];
        return horaA.localeCompare(horaB);
      });
      setReportes(sortedReportes);
    } catch (error) {
      console.error("Error al obtener reportes:", error);
      alert("Error al obtener reportes.");
    }
  };

  return (
    <div className={styles["table-container"]}>
      <div className={styles["search-container"]}>
        <label>Fecha:</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <label>Área:</label>
        <input
          type="text"
          placeholder="Ingresa el área"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <button onClick={handleSearch}>Buscar</button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Área</th>
            <th>Línea</th>
            <th>Hora</th>
            <th>Piezas OK</th>
            <th>Piezas NOK</th>
          </tr>
        </thead>
        <tbody>
          {reportes.length > 0 ? (
            reportes.map((reporte, index) => (
              <tr key={index}>
                <td>{reporte[0]}</td>
                <td>{reporte[1]}</td>
                <td>{reporte[2]}</td>
                <td>{reporte[3]}</td>
                <td>{reporte[4]}</td>
                <td>{reporte[5]}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className={styles["no-results"]}>
                No se encontraron reportes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;
