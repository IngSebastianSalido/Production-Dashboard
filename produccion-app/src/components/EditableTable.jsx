import React, { useState, useEffect } from 'react';
import MaterialTable from '@material-table/core';

const EditableTable = () => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchStops();
  }, []);

  const fetchStops = async () => {
    try {
      const response = await fetch(`${serverApiUrl}/api/paros`);
      let data = await response.json();
      console.log("Fetched Stops:", data);
  
      if (!Array.isArray(data)) {
        console.error("Error: Expected an array but received:", data);
        setStops([]);
        return;
      }
  
      // Convertir cada registro en un objeto con los nombres de campo utilizados en el frontend
      const formattedData = data.map((arr, index) => ({
        id: index, // Unique identifier for MaterialTable
        fecha: arr[0],
        area: arr[1],
        linea: arr[2],
        pn: arr[3],
        hora_paro: arr[4],
        hora_arranque: arr[5],
        diferencia_minutos: arr[6],
        categoria: arr[7],
        estacion: arr[8],
        modo_falla: arr[9], // Transformar a snake_case
        descripcion_modo_falla: arr[10], // Transformar a snake_case
        descripcion: arr[11],
      }));
  
      console.log("Formatted Stops:", formattedData);
      setStops(formattedData);
    } catch (error) {
      console.error('Error fetching stops:', error);
    } finally {
      setLoading(false);
    }
  };

const handleRowUpdate = async (newData, oldData, resolve) => {
  try {
    // Transformar los nombres de los campos para que coincidan con los esperados por el backend
    const transformedData = {
      ...newData,
      modoFalla: newData.modo_falla || oldData.modo_falla || '', // Transformar a camelCase
      descripcionModoFalla: newData.descripcion_modo_falla || oldData.descripcion_modo_falla || '', // Transformar a camelCase
    };

    console.log("Datos transformados enviados al backend (POST):", transformedData);

    // Eliminar el registro original
    const deleteResponse = await fetch(`${serverApiUrl}/api/paros`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fecha: oldData.fecha,
        area: oldData.area,
        linea: oldData.linea,
        pn: oldData.pn,
        hora_paro: oldData.hora_paro,
      }),
    });

    if (!deleteResponse.ok) {
      console.error('Error al eliminar el registro:', await deleteResponse.text());
      resolve();
      return;
    }

    // Crear un nuevo registro con los datos transformados
    const createResponse = await fetch(`${serverApiUrl}/api/paros`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transformedData),
    });

    if (!createResponse.ok) {
      console.error('Error al crear el nuevo registro:', await createResponse.text());
      resolve();
      return;
    }

    // Actualizar la tabla en el frontend
    const updatedStops = [...stops];
    const index = oldData.tableData.id;
    updatedStops[index] = newData;
    setStops(updatedStops);

    resolve();
  } catch (error) {
    console.error('Error al actualizar el registro:', error);
    resolve();
  }
};

const columns = [
  { title: 'Fecha', field: 'fecha', render: (rowData) => rowData.fecha || 'N/A' },
  { title: 'Área', field: 'area', width: '10%' },
  { title: 'Línea', field: 'linea', width: '10%' },
  { title: 'PN', field: 'pn', width: '10%' },
  { title: 'Hora de Paro', field: 'hora_paro', width: '10%' },
  { title: 'Hora de Arranque', field: 'hora_arranque', width: '10%' },
  { title: 'Duración (min)', field: 'diferencia_minutos', width: '10%' },
  { title: 'Categoría', field: 'categoria', width: '10%' },

  { title: 'Estación', field: 'estacion', width: '10%' },
  {
    title: 'Modo de Falla',
    field: 'modo_falla',
    width: '10%',
    editComponent: (props) => (
      <input
        type="text"
        value={props.value || ''}
        onChange={(e) => {
          console.log('Nuevo valor para Modo de Falla:', e.target.value);
          props.onChange(e.target.value);
        }}
      />
    ),
  },
  {
    title: 'Descripción Modo Falla',
    field: 'descripcion_modo_falla',
    width: '20%',
    editComponent: (props) => (
      <input
        type="text"
        value={props.value || ''}
        onChange={(e) => {
          console.log('Nuevo valor para Descripción Modo Falla:', e.target.value);
          props.onChange(e.target.value);
        }}
      />
    ),
  },
  { title: 'Descripción', field: 'descripcion', width: '20%' },

];

  console.log("Columns:", columns);

  return loading ? (
    <p>Loading stops data...</p>
  ) : (
<MaterialTable
  title="Stops Management"
  columns={columns}
  data={stops}
  editable={{
    onRowUpdate: (newData, oldData) =>
      new Promise((resolve) => {
        handleRowUpdate(newData, oldData, resolve);
      }),
  }}
  options={{
    filtering: true,
    actionsColumnIndex: -1,

    headerStyle: {
      backgroundColor: '#007BFF',
      color: '#FFF',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    rowStyle: {
      backgroundColor: '#333',
    },
    pageSize: 10,
    pageSizeOptions: [5, 10, 20],
  }}
/>
  );
};

export default EditableTable;
