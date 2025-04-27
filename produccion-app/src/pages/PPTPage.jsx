import React from "react";
import PPTViewer from "../components/PPTViewer";

const PPTPage = () => {
  const pptxUrl = import.meta.env.VITE_PPTX_URL;

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>Presentación</h1>
      <PPTViewer pptxUrl={pptxUrl} />
    </div>
  );
};

export default PPTPage;
