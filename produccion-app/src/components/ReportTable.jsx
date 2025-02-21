import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../ReportTable.module.css";

const ReportTable = () => {
  const [fecha, setFecha] = useState("");
  const [area, setArea] = useState("");
  const [linea, setLinea] = useState("");
  const [pn, setPn] = useState(""); // Agregar estado para PN
  const [reportes, setReportes] = useState([]);
  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [], modosFalla: [] });
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
      const response = await axios.get(`${serverApiUrl}/api/reportes/${fecha}/${area}/${linea}/${pn}`);
      setReportes(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  // Obtener líneas únicas
  const uniqueLineas = Array.from(new Set(options.lineas.map(linea => linea.name)));

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
            {uniqueLineas.filter(linea => options.lineas.some(l => l.name === linea && l.parent === area)).map((linea, index) => (
              <option key={index} value={linea}>{linea}</option>
            ))}
          </select>
        </div>
        <div className={styles["form-group"]}>
          <label>PN:</label>
          <select
            value={pn}
            onChange={(e) => setPn(e.target.value)}
            className={styles["search-select"]}
          >
            <option value="">Seleccionar PN</option>
            {options.lineas.filter(l => l.name === linea).map((linea, index) => (
              <option key={index} value={linea.pn}>{linea.pn}</option>
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
            <th>PN</th>
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
                <td>{reporte[6]}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className={styles["no-results"]}>No hay resultados</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ReportTable;