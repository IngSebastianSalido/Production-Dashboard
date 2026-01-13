import React, { useState, useEffect, useMemo } from 'react';
import MaterialTable from '@material-table/core';
import { parseYYYYMMDD } from '../utils/dateUtils';
import Modal from './Modal';
import StopRegister from './StopRegister';
import './EditableTable.css';

const EditableTable = ({ options: optionsProp, categories: categoriesProp, serverApiUrl: serverApiUrlProp }) => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editInitialData, setEditInitialData] = useState(null);
  const [rowBeingEdited, setRowBeingEdited] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const serverApiUrl = serverApiUrlProp || import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000';
  const formOptions = {
    areas: optionsProp?.areas ?? [],
    lineas: optionsProp?.lineas ?? [],
    estaciones: optionsProp?.estaciones ?? [],
    modosFalla: optionsProp?.modosFalla ?? [],
  };
  const formCategories = Array.isArray(categoriesProp) ? categoriesProp : [];

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
        paro_programado: arr[12],
        ajuste_proceso: arr[13],
      }));
  
      console.log("Formatted Stops:", formattedData);
      setStops(formattedData);
    } catch (error) {
      console.error('Error fetching stops:', error);
    } finally {
      setLoading(false);
    }
  };

  const crossesMidnight = (horaParo, horaArranque) => {
    if (!horaParo || !horaArranque) return false;
    const [h1, m1] = String(horaParo).split(':').map(Number);
    const [h2, m2] = String(horaArranque).split(':').map(Number);
    if (Number.isNaN(h1) || Number.isNaN(h2)) return false;
    if (h2 < h1) return true;
    if (h2 === h1) {
      const startMin = Number.isNaN(m1) ? 0 : m1;
      const endMin = Number.isNaN(m2) ? 0 : m2;
      return endMin <= startMin;
    }
    return false;
  };

  const normalizeFechaValue = (fechaStr) => {
    if (!fechaStr) return '';
    if (String(fechaStr).includes(' a ')) {
      const [fromStr] = String(fechaStr).split(' a ').map((s) => s.trim());
      return fromStr;
    }
    return String(fechaStr).trim();
  };

  const mapRowToFormData = (row) => ({
    fecha: normalizeFechaValue(row.fecha),
    area: row.area || '',
    linea: row.linea || '',
    pn: row.pn || '',
    estacion: row.estacion || '',
    modoFalla: row.modo_falla || '',
    descripcionModoFalla: row.descripcion_modo_falla || '',
    categoria: row.categoria || '',
    hora_paro: row.hora_paro || '',
    hora_arranque: row.hora_arranque || '',
    descripcion: row.descripcion || '',
    cruza_medianoche: row.cruza_medianoche ?? crossesMidnight(row.hora_paro, row.hora_arranque),
    ajuste_proceso: row.ajuste_proceso === 'Si',
  });

  const openEditModal = (rowData) => {
    setRowBeingEdited(rowData);
    setEditInitialData(mapRowToFormData(rowData));
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditInitialData(null);
    setRowBeingEdited(null);
  };

  const handleEditSubmit = async (updatedForm) => {
    if (!rowBeingEdited) return;
    setSavingEdit(true);
    try {
      const deleteResponse = await fetch(`${serverApiUrl}/api/paros`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fecha: rowBeingEdited.fecha,
          area: rowBeingEdited.area,
          linea: rowBeingEdited.linea,
          pn: rowBeingEdited.pn,
          hora_paro: rowBeingEdited.hora_paro,
        }),
      });

      if (!deleteResponse.ok) {
        const message = await deleteResponse.text();
        throw new Error(message || 'No se pudo eliminar el registro original');
      }

      const createResponse = await fetch(`${serverApiUrl}/api/paros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedForm),
      });

      if (!createResponse.ok) {
        const message = await createResponse.text();
        throw new Error(message || 'No se pudo guardar el registro actualizado');
      }

      alert('Paro actualizado correctamente');
      closeEditModal();
      fetchStops();
    } catch (error) {
      console.error('Error al actualizar el registro:', error);
      alert(`Error al actualizar el registro: ${error.message || error}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const compactCellStyle = (minWidth = 120, align = 'center') => ({
    minWidth,
    whiteSpace: 'nowrap',
    color: '#f8fafc',
    fontSize: '0.95rem',
    textAlign: align,
  });

  const wrapCellStyle = (minWidth = 200) => ({
    minWidth,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    color: '#f8fafc',
    fontSize: '0.95rem',
  });

  const columns = [
    {
      title: 'Fecha',
      field: 'fecha',
      editable: 'never',
      render: (rowData) => rowData.fecha || 'N/A',
      cellStyle: compactCellStyle(130),
      headerStyle: { minWidth: 130 },
    },
    { title: 'Área', field: 'area', cellStyle: compactCellStyle(140), headerStyle: { minWidth: 140 } },
    { title: 'Línea', field: 'linea', cellStyle: compactCellStyle(140), headerStyle: { minWidth: 140 } },
    { title: 'PN', field: 'pn', cellStyle: compactCellStyle(130), headerStyle: { minWidth: 130 } },
    { title: 'Hora de Paro', field: 'hora_paro', cellStyle: compactCellStyle(130), headerStyle: { minWidth: 130 } },
    { title: 'Hora de Arranque', field: 'hora_arranque', cellStyle: compactCellStyle(150), headerStyle: { minWidth: 150 } },
    {
      title: 'Duración (min)',
      field: 'diferencia_minutos',
      cellStyle: compactCellStyle(150),
      headerStyle: { minWidth: 150 },
    },
    { title: 'Categoría', field: 'categoria', cellStyle: compactCellStyle(150), headerStyle: { minWidth: 150 } },
    { title: 'Estación', field: 'estacion', cellStyle: compactCellStyle(150), headerStyle: { minWidth: 150 } },
    {
      title: 'Modo de Falla',
      field: 'modo_falla',
      cellStyle: compactCellStyle(160),
      headerStyle: { minWidth: 160 },
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
      cellStyle: wrapCellStyle(220),
      headerStyle: { minWidth: 220 },
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
    {
      title: 'Descripción',
      field: 'descripcion',
      cellStyle: wrapCellStyle(220),
      headerStyle: { minWidth: 220 },
    },
    {
      title: 'Paro Programado',
      field: 'paro_programado',
      cellStyle: compactCellStyle(150),
      headerStyle: { minWidth: 150 },
    },
    {
      title: 'Ajuste de Proceso',
      field: 'ajuste_proceso',
      cellStyle: compactCellStyle(150),
      headerStyle: { minWidth: 150 },
    },
    {
      title: 'Acciones',
      field: 'actions',
      sorting: false,
      filtering: false,
      cellStyle: {
        minWidth: 140,
        textAlign: 'center',
      },
      headerStyle: { minWidth: 140 },
      render: (rowData) => (
        <button
          type="button"
          className="table-action-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openEditModal(rowData);
          }}
        >
          Editar
        </button>
      ),
    },
  ];
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

  if (loading) {
    return <p className="stops-loading">Cargando paros...</p>;
  }

  return (
    <div className="stops-dashboard">
      <section className="filters-card">
        <div className="filters-header">
          <div>
            <p className="filters-title">Filtros avanzados</p>
            <p className="filters-subtitle">Agrega filtros para refinar la lista de paros.</p>
          </div>
          <button type="button" className="ghost-button" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="filter-from">Desde</label>
            <input
              id="filter-from"
              className="filter-input"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-to">Hasta</label>
            <input
              id="filter-to"
              className="filter-input"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-area">Área</label>
            <select
              id="filter-area"
              className="filter-input"
              value={filters.area}
              onChange={(e) =>
                setFilters((f) => ({ ...f, area: e.target.value, linea: '', pn: '', estacion: '', modo_falla: '' }))
              }
            >
              <option value="">Todas</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-linea">Línea</label>
            <select
              id="filter-linea"
              className="filter-input"
              value={filters.linea}
              onChange={(e) =>
                setFilters((f) => ({ ...f, linea: e.target.value, pn: '', estacion: '', modo_falla: '' }))
              }
            >
              <option value="">Todas</option>
              {lineaOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-pn">PN</label>
            <select
              id="filter-pn"
              className="filter-input"
              value={filters.pn}
              onChange={(e) => setFilters((f) => ({ ...f, pn: e.target.value }))}
            >
              <option value="">Todos</option>
              {pnOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-duration-min">Duración mín (min)</label>
            <input
              id="filter-duration-min"
              className="filter-input"
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={filters.duracionMin}
              onChange={(e) => setFilters((f) => ({ ...f, duracionMin: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-duration-max">Duración máx (min)</label>
            <input
              id="filter-duration-max"
              className="filter-input"
              type="number"
              min={0}
              step={1}
              placeholder=""
              value={filters.duracionMax}
              onChange={(e) => setFilters((f) => ({ ...f, duracionMax: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-category">Categoría</label>
            <select
              id="filter-category"
              className="filter-input"
              value={filters.categoria}
              onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
            >
              <option value="">Todas</option>
              {categoriaOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-station">Estación</label>
            <select
              id="filter-station"
              className="filter-input"
              value={filters.estacion}
              onChange={(e) => setFilters((f) => ({ ...f, estacion: e.target.value, modo_falla: '' }))}
            >
              <option value="">Todas</option>
              {estacionOptions.map((e1) => (
                <option key={e1} value={e1}>{e1}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-mode">Modo de Falla</label>
            <select
              id="filter-mode"
              className="filter-input"
              value={filters.modo_falla}
              onChange={(e) => setFilters((f) => ({ ...f, modo_falla: e.target.value }))}
            >
              <option value="">Todos</option>
              {modoFallaOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="stops-table-card">
        <MaterialTable
          title="Stops Management"
          columns={columns}
          data={filteredStops}
          options={{
            filtering: false,
            columnsButton: true,
            search: true,
            padding: 'normal',
            headerStyle: {
              background: 'linear-gradient(90deg, #0f62fe 0%, #3a86ff 50%, #06b6d4 100%)',
              color: '#fff',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            },
            rowStyle: (rowData) => ({
              backgroundColor: rowData.tableData.id % 2 === 0 ? '#0b1221' : '#101b33',
              color: '#f1f5f9',
            }),
            searchFieldStyle: {
              backgroundColor: '#0b1221',
              borderRadius: 10,
              color: '#f1f5f9',
              minWidth: 220,
            },
            pageSize: 10,
            pageSizeOptions: [10, 20, 50],
            maxBodyHeight: '60vh',
            tableLayout: 'auto',
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
              labelRowsPerPage: 'Filas por página',
              labelDisplayedRows: '{from}-{to} de {count}',
              firstTooltip: 'Primera página',
              previousTooltip: 'Anterior',
              nextTooltip: 'Siguiente',
              lastTooltip: 'Última página',
            },
          }}
        />
      </section>

      <Modal
        isOpen={editModalOpen}
        onClose={savingEdit ? () => {} : closeEditModal}
        title="Editar paro"
      >
        {editInitialData && (
          <StopRegister
            serverApiUrl={serverApiUrl}
            options={formOptions}
            categories={formCategories}
            initialData={editInitialData}
            mode="edit"
            onRegister={handleEditSubmit}
            onCancel={closeEditModal}
            submitLabel="Actualizar Paro"
            isSubmitting={savingEdit}
          />
        )}
      </Modal>
    </div>
  );
};

export default EditableTable;
