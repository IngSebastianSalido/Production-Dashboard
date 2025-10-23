// Mock API para simular peticiones a backend
// Este archivo puede ser reemplazado en el futuro por llamadas reales a API

/**
 * Genera datos aleatorios dentro de un rango
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @param {boolean} isInteger - Si es true, devuelve un entero, sino un decimal
 * @returns {number} Número aleatorio dentro del rango
 */
const randomBetween = (min, max, isInteger = true) => {
  const random = Math.random() * (max - min) + min;
  return isInteger ? Math.round(random) : parseFloat(random.toFixed(2));
};

/**
 * Obtiene datos de eficiencia de producción
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Promise} Promesa con los datos de eficiencia
 */
export const getEfficiencyData = (fecha) => {
  // Determinar fecha válida
  let fechaParam = fecha;
  if (!fechaParam || fechaParam === 'undefined') {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    fechaParam = `${year}-${month}-${day}`;
  }
  console.log('Fetching efficiency data for date:', fechaParam);
  // Obtener datos reales desde el backend
  return fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/efficiency/${fechaParam}`)
    .then(response => {
      if (!response.ok) throw new Error('Error al obtener datos de eficiencia');
      return response.json();
    })
    .then(data => {
      if (!data.metaValues || !data.realValues) {
        throw new Error('Datos de eficiencia incompletos o inválidos');
      }
      // Convertir a números
      const metaValues = data.metaValues.map(val => Number(val) || 0);
      const realValues = data.realValues.map(val => Number(val) || 0);
      return { metaValues, realValues };
    })
    .catch(error => {
      console.error('Error en getEfficiencyData:', error);
      return Promise.reject(error);
    });
};

/**
 * Obtiene datos de tiempo de ciclo
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Promise} Promesa con los datos de tiempo de ciclo
 */
export const getCycleTimeData = (fecha) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulamos que los datos dependen de la fecha
      // Evitar new Date(fecha) directo (pasa en equipos con distinto locale). Extraer día de forma robusta
      let seed = 1;
      try {
        const parts = String(fecha).split(/[-\/]/);
        seed = Number(parts[2]) || 1;
      } catch (e) { seed = 1; }
      
      // Tiempo objetivo fijo
      const targetTime = 140;
      
      // Tiempos de ciclo con variación aleatoria
      const cycleTimeData = Array(7).fill().map((_, i) => 
        randomBetween(targetTime - 15 + (seed % 5), targetTime + 20 + (seed % 8), false)
      );
      
      resolve({
        cycleTimeData,
        targetTime
      });
    }, 500);
  });
};

/**
 * Obtiene datos de defectos
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Promise} Promesa con los datos de defectos
 */
export const getDefectsData = (fecha) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulamos que los datos dependen de la fecha
      let seed = 1;
      try {
        const parts = String(fecha).split(/[-\/]/);
        seed = Number(parts[2]) || 1;
      } catch (e) { seed = 1; }
      
      // Categorías de defectos
      const categories = [
        'Ajuste Incorrecto', 
        'Material Defectuoso', 
        'Error de Operador', 
        'Falla de Máquina', 
        'Otros'
      ];
      
      // Valores de defectos con variación aleatoria
      const defectValues = [
        randomBetween(30 + (seed % 20), 60 + (seed % 10)),
        randomBetween(15 + (seed % 10), 35 + (seed % 10)),
        randomBetween(10 + (seed % 5), 25 + (seed % 5)),
        randomBetween(5 + (seed % 5), 15 + (seed % 5)),
        randomBetween(2, 8)
      ];
      
      resolve({
        categories,
        defectValues
      });
    }, 550);
  });
};
