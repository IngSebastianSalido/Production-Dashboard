import React, { useEffect, useState } from 'react';
import ProductionCharts from './components/ProductionCharts';
import axios from 'axios';
import './App.css';

const App = () => {
  const [config, setConfig] = useState({});
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await axios.get(`${serverApiUrl}/api/opciones`);
        setConfig(response.data);
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };

    fetchConfig();
  }, [serverApiUrl]);

  return (
    <div className="main-container">
      <h1 style={styles.title}>Resumen de Producción por Hora</h1>
      <ProductionCharts serverApiUrl={serverApiUrl} config={config} />
    </div>
  );
};

const styles = {
  title: {
    marginBottom: '20px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default App;