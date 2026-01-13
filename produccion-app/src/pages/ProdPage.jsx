import React from "react";
import ReportForm from "../components/ReportForm";
import ReportTable from "../components/ReportTable";
import "../App.css";

const ProdPage = () => {
  return (
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">Producción Hora por Hora</h1>
        <p className="page-subtitle">Registro y visualización de producción por hora</p>
      </div>
      
      <div className="panel">
        <ReportForm />
      </div>
      
      <div className="panel">
        <ReportTable />
      </div>
    </div>
  );
};

export default ProdPage;
