import React from "react";
import "../REA.css"; // Usamos mismo CSS

const StationsGrid = ({ estaciones }) => {
  return (
    <div className="stations-grid-container">
      {estaciones.map((station, idx) => (
        <div
          key={idx}
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
            <div>✅ OK: {station.ok}</div>
            <div>❌ NOK: {station.nok}</div>
            <div>📈 {station.percent.toFixed(2)}%</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StationsGrid;
