import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import StopPage from './pages/StopPage';
import ProdPage from './pages/ProdPage';
import Navbar from './components/NavBar';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Navbar />
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/stop" element={<StopPage />} />
      <Route path="/produccion" element={<ProdPage />} />
    </Routes>
  </BrowserRouter>
);
