import React from "react";

const PPTViewer = () => {
  const pptxUrl = import.meta.env.VITE_PPTX_URL; // 🔥 Lee desde tu .env

  if (!pptxUrl) {
    return <p>No se proporcionó una URL de presentación.</p>;
  }

  const abrirPDF = () => {
    window.open(pptxUrl, "_blank"); // 🔥 Usa la URL correcta del .env
  };

  return (
    <div style={{ textAlign: "center", padding: "40px" }}>
      <h2>Presentación</h2>
      <button 
        style={{ padding: "10px 20px", fontSize: "18px", cursor: "pointer", borderRadius: "10px", backgroundColor: "#4CAF50", color: "white", border: "none" }}
        onClick={abrirPDF}
      >
        Abrir presentación
      </button>
    </div>
  );
};

export default PPTViewer;
