import React, { useState, useEffect, useMemo } from 'react';
import MaterialTable from '@material-table/core';
import { parseYYYYMMDD } from '../utils/dateUtils';

const EditableTable = () => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';

  // Filtros avanzados (barra superior)
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    area: '',
    linea: '',
    pn: '',
    categoria: '',
    estacion: '',
    modo_falla: '',
    duracionMin: '',
    duracionMax: '',
  });

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
    // Confirmación si la duración supera 60 minutos (considerando posible cruce de medianoche)
    const computeMinutes = (hp, ha) => {
      if (!hp || !ha) return 0;
      const [h1, m1] = String(hp).split(':').map(Number);
      const [h2, m2] = String(ha).split(':').map(Number);
      const start = (isNaN(h1) ? 0 : h1) * 60 + (isNaN(m1) ? 0 : m1);
      let end = (isNaN(h2) ? 0 : h2) * 60 + (isNaN(m2) ? 0 : m2);
      if (end <= start) end += 24 * 60; // tratar como siguiente día si es menor o igual
      return end - start;
    };

    if (newData.hora_paro && newData.hora_arranque) {
      const minutes = computeMinutes(newData.hora_paro, newData.hora_arranque);
      if (minutes > 60) {
        const proceed = window.confirm(`El paro dura ${minutes} minutos (> 60). ¿Deseas continuar con la actualización?`);
        if (!proceed) {
          resolve();
          return;
        }
      }
    }

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

  // Opciones únicas para selects de filtros
  const areaOptions = useMemo(
    () => Array.from(new Set(stops.map((s) => s.area).filter(Boolean))).sort(),
    [stops]
  );
  const lineaOptions = useMemo(() => {
    const pool = filters.area ? stops.filter((s) => s.area === filters.area) : stops;
    return Array.from(new Set(pool.map((s) => s.linea).filter(Boolean))).sort();
  }, [stops, filters.area]);
  const categoriaOptions = useMemo(
    () => Array.from(new Set(stops.map((s) => s.categoria).filter(Boolean))).sort(),
    [stops]
  );
  const pnOptions = useMemo(() => {
    let pool = stops;
    if (filters.area) pool = pool.filter((s) => s.area === filters.area);
    if (filters.linea) pool = pool.filter((s) => s.linea === filters.linea);
    return Array.from(new Set(pool.map((s) => s.pn).filter(Boolean))).sort();
  }, [stops, filters.area, filters.linea]);
  const estacionOptions = useMemo(() => {
    let pool = stops;
    if (filters.area) pool = pool.filter((s) => s.area === filters.area);
    if (filters.linea) pool = pool.filter((s) => s.linea === filters.linea);
    return Array.from(new Set(pool.map((s) => s.estacion).filter(Boolean))).sort();
  }, [stops, filters.area, filters.linea]);
  const modoFallaOptions = useMemo(() => {
    let pool = stops;
    if (filters.area) pool = pool.filter((s) => s.area === filters.area);
    if (filters.linea) pool = pool.filter((s) => s.linea === filters.linea);
    if (filters.estacion) pool = pool.filter((s) => s.estacion === filters.estacion);
    return Array.from(new Set(pool.map((s) => s.modo_falla).filter(Boolean))).sort();
  }, [stops, filters.area, filters.linea, filters.estacion]);

  // Normaliza el campo fecha (string) a un rango [start, end]
  const normalizeFechaToRange = (fechaStr) => {
    if (!fechaStr) return null;
    if (String(fechaStr).includes(' a ')) {
      const [fromStr, toStr] = String(fechaStr).split(' a ').map((s) => s.trim());
      const from = parseYYYYMMDD(fromStr);
      const to = parseYYYYMMDD(toStr);
      if (!from || !to) return null;
      return { start: from, end: to };
    }
    const d = parseYYYYMMDD(String(fechaStr).trim());
    if (!d) return null;
    return { start: d, end: d };
  };

  const filteredStops = useMemo(() => {
    const fromDate = filters.from ? parseYYYYMMDD(filters.from) : null;
    const toDate = filters.to ? parseYYYYMMDD(filters.to) : null;

    return stops.filter((row) => {
      // Filtro por área
      if (filters.area && row.area !== filters.area) return false;
      // Filtro por línea
      if (filters.linea && row.linea !== filters.linea) return false;
      // Filtro por PN
      if (filters.pn && row.pn !== filters.pn) return false;
      // Filtro por categoría
      if (filters.categoria && row.categoria !== filters.categoria) return false;
      // Filtro por estación
      if (filters.estacion && row.estacion !== filters.estacion) return false;
      // Filtro por modo de falla
      if (filters.modo_falla && row.modo_falla !== filters.modo_falla) return false;

      // Filtro por rango de fechas (inclusivo)
      if (fromDate || toDate) {
        const range = normalizeFechaToRange(row.fecha);
        if (!range) return false;
        const rowStart = new Date(range.start);
        const rowEnd = new Date(range.end);
        if (fromDate && rowEnd < fromDate) return false; // termina antes del inicio
        if (toDate) {
          const toInclusive = new Date(toDate);
          if (rowStart > toInclusive) return false; // empieza después del fin
        }
      }

      // Filtro por duración (min/max)
      if (filters.duracionMin !== '' || filters.duracionMax !== '') {
        const dur = Number(row.diferencia_minutos);
        if (Number.isNaN(dur)) return false;
        if (filters.duracionMin !== '' && dur < Number(filters.duracionMin)) return false;
        if (filters.duracionMax !== '' && dur > Number(filters.duracionMax)) return false;
      }
      return true;
    });
  }, [stops, filters, parseYYYYMMDD]);

  const clearFilters = () => setFilters({
    from: '',
    to: '',
    area: '',
    linea: '',
    pn: '',
    categoria: '',
    estacion: '',
    modo_falla: '',
    duracionMin: '',
    duracionMax: '',
  });

  return loading ? (
    <p>Loading stops data...</p>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra de filtros en recuadro */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        alignItems: 'end',
        padding: 12,
        border: '1px solid #444',
        borderRadius: 8,
        background: '#222'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Desde</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Hasta</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Área</label>
          <select
            value={filters.area}
            onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value, linea: '', pn: '', estacion: '', modo_falla: '' }))}
          >
            <option value="">Todas</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Línea</label>
          <select
            value={filters.linea}
            onChange={(e) => setFilters((f) => ({ ...f, linea: e.target.value, pn: '', estacion: '', modo_falla: '' }))}
          >
            <option value="">Todas</option>
            {lineaOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>PN</label>
          <select
            value={filters.pn}
            onChange={(e) => setFilters((f) => ({ ...f, pn: e.target.value }))}
          >
            <option value="">Todos</option>
            {pnOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {/* Duración (min) - mantener orden de columnas */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Duración mín (min)</label>
          <input
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={filters.duracionMin}
            onChange={(e) => setFilters((f) => ({ ...f, duracionMin: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Duración máx (min)</label>
          <input
            type="number"
            min={0}
            step={1}
            placeholder=""
            value={filters.duracionMax}
            onChange={(e) => setFilters((f) => ({ ...f, duracionMax: e.target.value }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Categoría</label>
          <select
            value={filters.categoria}
            onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
          >
            <option value="">Todas</option>
            {categoriaOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Estación</label>
          <select
            value={filters.estacion}
            onChange={(e) => setFilters((f) => ({ ...f, estacion: e.target.value, modo_falla: '' }))}
          >
            <option value="">Todas</option>
            {estacionOptions.map((e1) => (
              <option key={e1} value={e1}>{e1}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label>Modo de Falla</label>
          <select
            value={filters.modo_falla}
            onChange={(e) => setFilters((f) => ({ ...f, modo_falla: e.target.value }))}
          >
            <option value="">Todos</option>
            {modoFallaOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button onClick={clearFilters} style={{ height: 36 }}>Limpiar</button>
      </div>

      {/* Tabla con scroll horizontal y altura máxima */}
      <div style={{ overflowX: 'auto' }}>
        <MaterialTable
          title="Stops Management"
          columns={columns}
          data={filteredStops}
          editable={{
            onRowUpdate: (newData, oldData) =>
              new Promise((resolve) => {
                handleRowUpdate(newData, oldData, resolve);
              }),
          }}
          options={{
            filtering: false, // usamos la barra superior, no la fila de filtros
            actionsColumnIndex: -1,
            columnsButton: true,
            search: true,
            padding: 'dense',
            headerStyle: {
              backgroundColor: '#007BFF',
              color: '#FFF',
              fontWeight: 'bold',
              textAlign: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            },
            rowStyle: {
              backgroundColor: '#333',
            },
            pageSize: 10,
            pageSizeOptions: [10, 20, 50],
            maxBodyHeight: '60vh',
            tableLayout: 'fixed',
          }}
          localization={{
            toolbar: {
              searchPlaceholder: 'Buscar',
              showColumnsTitle: 'Columnas',
              addRemoveColumns: 'Mostrar/Ocultar columnas',
            },
            header: { actions: 'Acciones' },
            body: {
              emptyDataSourceMessage: 'Sin registros para mostrar',
              editRow: { deleteText: '¿Eliminar este registro?', cancelTooltip: 'Cancelar', saveTooltip: 'Guardar' },
            },
            pagination: {
              labelRowsSelect: 'filas',
              labelDisplayedRows: '{from}-{to} de {count}',
              firstTooltip: 'Primera página',
              previousTooltip: 'Anterior',
              nextTooltip: 'Siguiente',
              lastTooltip: 'Última página',
            },
          }}
        />
      </div>
    </div>
  );
};

export default EditableTable;
