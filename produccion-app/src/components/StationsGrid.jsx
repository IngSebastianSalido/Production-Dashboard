import React from "react";
import "../REA.css"; // Reuse general REA styles

const StationsGrid = ({ estaciones }) => (
  <div className="stations-grid-container">
    {estaciones.map((station, idx) => {
      const okCount = Number.isFinite(station.ok) ? station.ok : 0;
      const nokCount = Number.isFinite(station.nok) ? station.nok : 0;
      const percent = Number.isFinite(station.percent) ? station.percent : 0;

      return (
        <div
          key={idx}
          className={`rea-station-card ${
            percent >= 95 ? "green" : percent >= 90 ? "yellow" : "red"
          }`}
        >
          <h4 className="rea-station-name">{station.station}</h4>
          <div className="rea-station-metrics">
            <div className="metric-box">
              <span className="metric-label">OK</span>
              <span className="metric-value">{okCount}</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">NOK</span>
              <span className="metric-value">{nokCount}</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">%</span>
              <span className="metric-value">{percent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

export default StationsGrid;

