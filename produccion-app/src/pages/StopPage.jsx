import React, { useState, useEffect } from 'react';
import StopRegister from '../components/StopRegister'; // Actualiza la ruta
import EditableTable from '../components/EditableTable';

const StopPage = () => {
  const [options, setOptions] = useState({ areas: [], lineas: [], estaciones: [], modosFalla: [] });
  const [categories, setCategories] = useState([]);
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/opciones`);
        const data = await response.json();
        setOptions(data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/categories`);
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchOptions();
    fetchCategories();
  }, [serverApiUrl]);

  const handleRegister = () => {
    // Lógica adicional después de registrar un paro (si es necesario)
  };

  return (
    <div className="main-container">
      <div className="page-header">
        <h1 className="page-title">Gestión de Paros de Línea</h1>
        <p className="page-subtitle">Registro y administración de paros de producción</p>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h2>Registrar Nuevo Paro</h2>
        </div>
        <StopRegister
          serverApiUrl={serverApiUrl}
          options={options}
          categories={categories}
          onRegister={handleRegister}
        />
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h2>Tabla de Paros</h2>
        </div>
        <EditableTable
          serverApiUrl={serverApiUrl}
          options={options}
          categories={categories}
        />
      </div>
    </div>
  );
};

export default StopPage;
