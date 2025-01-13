import React from "react";
import ReportForm from "../components/ReportForm";
import ReportTable from "../components/ReportTable";
import "../App.css";

const ProdPage = () => {
  return (
    <div className="main-container">
      <h1>Reporte de Producción Hora por Hora</h1>
      <ReportForm />
      <ReportTable />
    </div>
  );
};

export default ProdPage;
