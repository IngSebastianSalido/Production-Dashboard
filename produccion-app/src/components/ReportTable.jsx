import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../ReportTable.module.css";

const ReportTable = () => {
  const [fecha, setFecha] = useState("");
  const [area, setArea] = useState("");
  const [linea, setLinea] = useState("");
  const [reportes, setReportes] = useState([]);
  const [options, setOptions] = useState({ areas: [], lineas: [] });
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await axios.get(`${serverApiUrl}/api/opciones`);
        setOptions(response.data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    fetchOptions();
  }, [serverApiUrl]);

  const handleSearch = async () => {
    try {
      const response = await axios.get(`${serverApiUrl}/api/reportes/${fecha}/${area}/${linea}`);
      setReportes(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  return (
    <div className={styles["table-container"]}>
      <div className={styles["search-container"]}>
        <div className={styles["form-group"]}>
          <label>Fecha:</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={styles["search-input"]}
          />
        </div>
        <div className={styles["form-group"]}>
          <label>Área:</label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={styles["search-select"]}
          >
            <option value="">Seleccionar Área</option>
            {options.areas.map((area, index) => (
              <option key={index} value={area.name}>{area.name}</option>
            ))}
          </select>
        </div>
        <div className={styles["form-group"]}>
          <label>Línea:</label>
          <select
            value={linea}
            onChange={(e) => setLinea(e.target.value)}
            className={styles["search-select"]}
          >
            <option value="">Seleccionar Línea</option>
            {options.lineas.filter(linea => linea.parent === area).map((linea, index) => (
              <option key={index} value={linea.name}>{linea.name}</option>
            ))}
          </select>
        </div>
        <button onClick={handleSearch} className={styles["search-button"]}>
          Buscar
        </button>
      </div>
      <table className={styles["table"]}>
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
              <td colSpan="6" className={styles["no-results"]}>No hay resultados</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;