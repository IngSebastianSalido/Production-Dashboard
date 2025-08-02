import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

const StopChart = ({ fecha, area }) => {
  const [chartData, setChartData] = useState(null);
  const serverApiUrl = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3000'; // Asegúrate de que la URL sea válida

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${serverApiUrl}/api/paros`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Calcular la fecha del día siguiente para el rango de 7am a 7am
        const fechaActual = new Date(fecha);
        const fechaSiguiente = new Date(fechaActual);
        fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
        
        const fechaActualStr = fechaActual.toISOString().split('T')[0];
        const fechaSiguienteStr = fechaSiguiente.toISOString().split('T')[0];

        // Filtrar por fecha y área (turno de 7am a 7am del día siguiente)
        const filteredData = data.filter(paro => {
          const fechaParo = paro[0];
          const areaParo = paro[1];
          const horaParo = paro[4];
          
          // Filtrar por área si se especifica
          if (area && areaParo !== area) {
            return false;
          }
          
          // Manejar paros que cruzan medianoche (formato antiguo)
          if (fechaParo.includes(' a ')) {
            const [fechaInicio] = fechaParo.split(' a ');
            if (fechaInicio === fechaActualStr) {
              const [hora] = horaParo.split(':').map(Number);
              return hora >= 7;
            }
            return false;
          }
          
          // Lógica para turno de 7am a 7am del día siguiente
          if (fechaParo === fechaActualStr) {
            // Paros del día actual desde las 7am
            const [hora] = horaParo.split(':').map(Number);
            return hora >= 7;
          } else if (fechaParo === fechaSiguienteStr) {
            // Paros del día siguiente hasta las 7am
            const [hora] = horaParo.split(':').map(Number);
            return hora < 7;
          }
          
          return false;
        });

        // Crear array de horas para el turno de 7am a 7am (24 horas)
        const hours = [];
        for (let i = 0; i < 24; i++) {
          const hora = (7 + i) % 24;
          const label = `${hora.toString().padStart(2, '0')}:00`;
          hours.push(label);
        }
        
        const totalMinutes = Array(24).fill(60);
        const stopMinutes = Array(24).fill(0);

        filteredData.forEach(paro => {
          const fechaParo = paro[0];
          const horaParo = paro[4];
          const horaArranque = paro[5];
          const diferenciaMinutos = parseInt(paro[6], 10);
          
          // Parsear la hora del paro
          const [hora, minuto] = horaParo.split(':').map(Number);
          
          // Manejar paros que cruzan medianoche (formato antiguo con "a")
          if (fechaParo.includes(' a ')) {
            // Este es un paro que cruza medianoche en formato antiguo
            // Necesitamos calcular correctamente las horas
            const [horaArr, minArr] = horaArranque.split(':').map(Number);
            
            if (hora >= 7) {
              // Parte del primer día (desde hora_paro hasta medianoche)
              let horaIndex = hora - 7;
              let remainingMinutes = (23 * 60 + 59) - (hora * 60 + minuto) + 1;
              let currentHour = horaIndex;
              let currentMinute = minuto;

              while (remainingMinutes > 0 && currentHour < 24) {
                const availableMinutesInHour = 60 - currentMinute;
                const minutesToAdd = Math.min(availableMinutesInHour, remainingMinutes);
                stopMinutes[currentHour] += minutesToAdd;
                remainingMinutes -= minutesToAdd;
                currentHour++;
                currentMinute = 0;
              }
            }
            
            if (horaArr < 7) {
              // Parte del segundo día (desde medianoche hasta hora_arranque)
              let horaIndex = 17 + horaArr; // 17 = 24 - 7
              let remainingMinutes = horaArr * 60 + minArr;
              let currentHour = 17; // Comienza en la hora 17 del turno (00:00)
              let currentMinute = 0;

              while (remainingMinutes > 0 && currentHour < 24) {
                const availableMinutesInHour = 60 - currentMinute;
                const minutesToAdd = Math.min(availableMinutesInHour, remainingMinutes);
                stopMinutes[currentHour] += minutesToAdd;
                remainingMinutes -= minutesToAdd;
                currentHour++;
                currentMinute = 0;
              }
            }
            return;
          }
          
          // Calcular el índice en el array de horas del turno
          let horaIndex;
          if (fechaParo === fechaActualStr) {
            // Paro del día actual (7am en adelante)
            if (hora >= 7) {
              horaIndex = hora - 7;
            } else {
              return; // Saltar paros antes de las 7am del día actual
            }
          } else {
            // Paro del día siguiente (antes de las 7am)
            if (hora < 7) {
              horaIndex = 17 + hora; // 17 = 24 - 7
            } else {
              return; // Saltar paros después de las 7am del día siguiente
            }
          }
          
          let remainingMinutes = diferenciaMinutos;
          let currentHour = horaIndex;
          let currentMinute = minuto;

          while (remainingMinutes > 0 && currentHour < 24) {
            const availableMinutesInHour = 60 - currentMinute;
            const minutesToAdd = Math.min(availableMinutesInHour, remainingMinutes);

            stopMinutes[currentHour] += minutesToAdd;
            remainingMinutes -= minutesToAdd;

            currentHour++;
            currentMinute = 0; // Reset minutos para la siguiente hora
          }
        });

        const runningMinutes = totalMinutes.map((total, i) => total - stopMinutes[i]);

        setChartData({
          labels: hours,
          datasets: [
            {
              label: 'Minutos Corriendo',
              data: runningMinutes,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              stack: 'combined',
            },
            {
              label: 'Minutos en Paro',
              data: stopMinutes,
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              stack: 'combined',
            },
          ],
        });
      } catch (error) {
        console.error('Error fetching stop data:', error.message);
      }
    };

    if (fecha) {
      fetchData();
    }
  }, [fecha, area, serverApiUrl]);

  if (!chartData) {
    return <div>Cargando datos...</div>;
  }

  return (
    <div>
      <h2>
        Minutos de Paro por Hora (Turno 7am-7am)
        {area && ` - Área: ${area}`}
      </h2>
      <Bar
        data={chartData}
        options={{
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, max: 60 },
          },
        }}
      />
    </div>
  );
};

export default StopChart;