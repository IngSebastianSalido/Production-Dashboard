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
import PPTPage from './pages/PPTPage'; // Importar la nueva página de presentación
import ProductionBoard from './pages/ProductionBoard'; // Importar la página de ProductionBoard
import Reports from './pages/Reports'; // Nueva página Reports
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Navbar />
    <div className="content-container"> {/* Nuevo contenedor */}
    <Routes>
  <Route path="/" element={<REA />} />
  <Route path="/stop" element={<StopPage />} />
  <Route path="/produccion" element={<ProdPage />} />
  <Route path="/opciones" element={<ConfigPage />} />
  <Route path="/grafica-paros" element={<StopChartPage />} />
  <Route path="/presentacion" element={<PPTPage />} /> 
  <Route path="/production-board" element={<ProductionBoard />} /> 
  <Route path="/reports" element={<Reports />} /> {/* Ruta mínima para Reports */}
</Routes>

    </div>
  </BrowserRouter>
);