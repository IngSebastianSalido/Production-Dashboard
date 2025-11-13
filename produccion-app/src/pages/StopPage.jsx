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
    <div>
      <h1>Registrar Paro de Línea</h1>
      <StopRegister
        serverApiUrl={serverApiUrl}
        options={options}
        categories={categories}
        onRegister={handleRegister}
      />
      <div className="table-container">
        <h1>Stops Management</h1>
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
