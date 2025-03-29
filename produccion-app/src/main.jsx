import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import StopPage from './pages/StopPage';
import ProdPage from './pages/ProdPage';
import ConfigPage from './pages/ConfigPage';
import StopChartPage from './pages/StopChartPage'; // Importar la nueva página
import Navbar from './components/NavBar';
import REA from './pages/REA';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Navbar />
    <div className="content-container"> {/* Nuevo contenedor */}
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/rea" element={<REA />} />
        <Route path="/stop" element={<StopPage />} />
        <Route path="/produccion" element={<ProdPage />} />
        <Route path="/opciones" element={<ConfigPage />} />
        <Route path="/grafica-paros" element={<StopChartPage />} /> {/* Nueva ruta */}
      </Routes>
    </div>
  </BrowserRouter>
);