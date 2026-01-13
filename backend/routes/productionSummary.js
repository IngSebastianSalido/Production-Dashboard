const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * Factory para crear la ruta de resumen de producción
 * @param {string} productionReportPath - Ruta al archivo ProductionReport.csv
 * @param {string} parosPath - Ruta al archivo paros.csv
 * @param {string} eolCutsPath - Ruta al archivo EOL_Cuts.csv
 * @param {string} shiftsConfigPath - Ruta al archivo shifts.json
 */
module.exports = function (productionReportPath, parosPath, eolCutsPath, shiftsConfigPath) {
    const router = express.Router();

    // Cargar configuración de turnos
    function loadShiftsConfig() {
        try {
            const data = fs.readFileSync(shiftsConfigPath, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error al cargar configuración de turnos:', err);
            return { shifts: [] };
        }
    }

    // Determinar el turno basado en la hora
    function determineShift(date, shiftsConfig) {
        const hour = date.getHours();
        const minute = date.getMinutes();
        const totalMinutes = hour * 60 + minute;

        for (const shift of shiftsConfig.shifts) {
            const startMinutes = shift.startHour * 60 + shift.startMinute;
            let endMinutes = shift.endHour * 60 + shift.endMinute;

            // Si el turno cruza la medianoche
            if (endMinutes <= startMinutes) {
                endMinutes += 24 * 60;
                if (totalMinutes >= startMinutes || totalMinutes < (shift.endHour * 60 + shift.endMinute)) {
                    return shift;
                }
            } else {
                if (totalMinutes >= startMinutes && totalMinutes < endMinutes) {
                    return shift;
                }
            }
        }

        return shiftsConfig.shifts[0] || { id: 1, name: 'Turno 1', durationMinutes: 480 };
    }

    // Obtener el día de la semana en español
    function getWeekdayInSpanish(date) {
        const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return weekdays[date.getDay()];
    }

    // Obtener el número de la semana del año
    function getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    // Parsear CSV a array de objetos
    function parseCSV(filePath, delimiter = ';') {
        try {
            console.log(`Attempting to read CSV: ${filePath}`);
            const content = fs.readFileSync(filePath, 'utf-8');
            console.log(`File content length: ${content.length} bytes`);
            const lines = content.split('\n').filter(line => line.trim());
            console.log(`Total lines after filter: ${lines.length}`);
            if (lines.length === 0) return [];

            const headers = lines[0].split(delimiter).map(h => h.trim());
            console.log(`Headers: ${headers.slice(0, 5).join(', ')}...`);
            const rows = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(delimiter);
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] ? values[index].trim() : '';
                });
                rows.push(row);
            }

            console.log(`Parsed ${rows.length} rows from ${filePath}`);
            return rows;
        } catch (err) {
            console.error(`Error al parsear CSV ${filePath}:`, err);
            return [];
        }
    }

    // Parsear fecha y hora de EOL_Cuts
    function parseEOLDateTime(dateStr, timeStr) {
        try {
            if (!dateStr || !timeStr) return null;
            // Formato: "9/23/2025" y "10:59:34 AM"
            const dateParts = dateStr.split('/');
            if (dateParts.length !== 3) return null;
            
            const [month, day, year] = dateParts;
            const timeParts = timeStr.split(' ');
            if (timeParts.length !== 2) return null;
            
            const [time, period] = timeParts;
            const hourParts = time.split(':');
            if (hourParts.length < 2) return null;
            
            const [hours, minutes, seconds] = hourParts;

            let hour = parseInt(hours, 10);
            if (isNaN(hour)) return null;
            
            if (period === 'PM' && hour !== 12) hour += 12;
            if (period === 'AM' && hour === 12) hour = 0;

            return new Date(year, month - 1, day, hour, minutes || 0, seconds || 0);
        } catch (err) {
            console.error('Error al parsear fecha/hora EOL:', err);
            return null;
        }
    }

    // Parsear fecha de paros (formato: 2025-03-10)
    function parseParoDate(dateStr) {
        try {
            const [year, month, day] = dateStr.split('-');
            return new Date(year, month - 1, day);
        } catch (err) {
            return null;
        }
    }
    // Parsear fecha de ProductionReport.csv (formato MM/DD/YYYY)
    function parseProductionReportDate(dateStr) {
        try {
            if (!dateStr || typeof dateStr !== 'string') return null;
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            
            const [month, day, year] = parts;
            const m = parseInt(month, 10);
            const d = parseInt(day, 10);
            const y = parseInt(year, 10);
            
            if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
            
            return new Date(y, m - 1, d);
        } catch (err) {
            return null;
        }
    }
    // Parsear hora (formato: HH:mm)
    function parseTime(timeStr) {
        try {
            const [hours, minutes] = timeStr.split(':').map(n => parseInt(n, 10));
            return { hours, minutes };
        } catch (err) {
            return { hours: 0, minutes: 0 };
        }
    }

    // Verificar si una fecha/hora está dentro de un rango de turno
    function isInShiftRange(date, shiftStart, shiftEnd) {
        const dateTime = date.getTime();
        return dateTime >= shiftStart.getTime() && dateTime < shiftEnd.getTime();
    }

    // Calcular inicio y fin del turno para una fecha dada
    function getShiftRange(date, shift) {
        const startDate = new Date(date);
        startDate.setHours(shift.startHour, shift.startMinute, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(shift.endHour, shift.endMinute, 0, 0);

        // Si el turno cruza la medianoche
        if (shift.endHour < shift.startHour || (shift.endHour === shift.startHour && shift.endMinute <= shift.startMinute)) {
            endDate.setDate(endDate.getDate() + 1);
        }

        return { startDate, endDate };
    }

    /**
     * GET /api/production-summary
     * Genera el resumen de producción por batch leyendo directamente ProductionReport.csv
     * Crea batches por cambio de receta dentro del turno
     */
    router.get('/production-summary', async (req, res) => {
        console.log('=== INICIO production-summary ===');
        try {
            console.log('Step 1: Loading config...');
            const shiftsConfig = loadShiftsConfig();
            
            console.log('Step 2: Parsing CSVs...');
            const productionRecords = parseCSV(productionReportPath, ';');
            const paros = parseCSV(parosPath, ';');
            
            console.log(`ProductionReport: ${productionRecords.length}, Paros: ${paros.length}`);

            const RATE_PER_HOUR = 180; // piezas por hora

            console.log('Step 3: Processing production records...');
            
            // Parsear y ordenar todos los registros por fecha/hora
            const parsedRecords = [];
            for (const record of productionRecords) {
                try {
                    const dateStr = record.DateAcquisition;
                    const timeStr = record.TimeAcquisition;
                    const pn = (record.RECIPE || 'UNKNOWN').trim();
                    
                    // Parsear fecha y hora
                    const recordDate = parseProductionReportDate(dateStr);
                    if (!recordDate) continue;

                    // Parsear hora (formato: HH:mm:ss AM/PM)
                    const timeParts = timeStr.split(' ');
                    if (timeParts.length !== 2) continue;
                    const [time, period] = timeParts;
                    const [hoursStr, minutesStr, secondsStr] = time.split(':');
                    let hours = parseInt(hoursStr, 10);
                    const minutes = parseInt(minutesStr, 10);
                    const seconds = parseInt(secondsStr, 10) || 0;
                    
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                    
                    recordDate.setHours(hours, minutes, seconds, 0);

                    const shift = determineShift(recordDate, shiftsConfig);
                    
                    parsedRecords.push({
                        dateTime: recordDate,
                        pn: pn,
                        shift: shift,
                        eolOk: parseInt(record.EOLOk, 10) || 0,
                        eolNok: parseInt(record.EOLNok, 10) || 0
                    });
                } catch (err) {
                    // Silently skip invalid records
                }
            }

            // Ordenar por fecha/hora
            parsedRecords.sort((a, b) => a.dateTime - b.dateTime);
            
            console.log(`Parsed and sorted ${parsedRecords.length} records`);

            // Crear batches detectando cambios de receta
            const batches = [];
            let currentBatch = null;
            let batchCounter = 1;

            for (let i = 0; i < parsedRecords.length; i++) {
                const record = parsedRecords[i];
                const dateKey = record.dateTime.toISOString().split('T')[0];
                
                // Detectar si necesitamos crear un nuevo batch
                const needNewBatch = !currentBatch || 
                    currentBatch.pn !== record.pn ||
                    currentBatch.dateKey !== dateKey ||
                    currentBatch.shift.id !== record.shift.id;

                if (needNewBatch) {
                    // Cerrar el batch anterior si existe
                    if (currentBatch) {
                        currentBatch.endTime = parsedRecords[i - 1].dateTime;
                        batches.push(currentBatch);
                    }

                    // Obtener límites del turno
                    const { startDate: shiftStart, endDate: shiftEnd } = getShiftRange(record.dateTime, record.shift);

                    // Crear nuevo batch con array de registros para calcular diferencias
                    currentBatch = {
                        batchId: batchCounter++,
                        pn: record.pn,
                        date: dateKey,
                        dateKey: dateKey,
                        startTime: record.dateTime,
                        endTime: null,
                        shiftStart: shiftStart,
                        shiftEnd: shiftEnd,
                        weekday: getWeekdayInSpanish(record.dateTime),
                        week: getWeekNumber(record.dateTime),
                        shift: record.shift,
                        records: [record] // Guardar todos los registros del batch
                    };
                } else {
                    // Agregar registro al batch actual
                    currentBatch.records.push(record);
                }
            }

            // Cerrar el último batch
            if (currentBatch) {
                currentBatch.endTime = parsedRecords[parsedRecords.length - 1].dateTime;
                batches.push(currentBatch);
            }

            console.log(`Step 4: Created ${batches.length} batches by recipe changes`);
            console.log('Step 5: Calculating times and downtimes...');

            // Calcular tiempos y paros para cada batch
            const summaryData = batches.map(batch => {
                const batchStart = batch.startTime;
                const batchEnd = batch.endTime;
                
                // Duración real del batch en minutos
                const durationMinutes = (batchEnd - batchStart) / (1000 * 60);

                // Calcular producción como sumatoria de diferencias (detectando reinicios de contador)
                let eolOk = 0;
                let eolNok = 0;
                
                for (let i = 0; i < batch.records.length; i++) {
                    const current = batch.records[i];
                    
                    if (i === 0) {
                        // Primer registro: usar el valor como base (ya producido antes de este batch)
                        continue;
                    }
                    
                    const previous = batch.records[i - 1];
                    
                    // Calcular diferencia de EOL OK
                    if (current.eolOk >= previous.eolOk) {
                        // Incremento normal
                        eolOk += (current.eolOk - previous.eolOk);
                    } else {
                        // Reinicio de contador: sumar el valor actual (asume que reinicia en 0)
                        eolOk += current.eolOk;
                    }
                    
                    // Calcular diferencia de EOL NOK
                    if (current.eolNok >= previous.eolNok) {
                        // Incremento normal
                        eolNok += (current.eolNok - previous.eolNok);
                    } else {
                        // Reinicio de contador: sumar el valor actual
                        eolNok += current.eolNok;
                    }
                }

                const totalPieces = eolOk + eolNok;
                let downtimeScheduled = 0;
                let downtimeNotScheduled = 0;

                for (const paro of paros) {
                    const paroDate = parseParoDate(paro.fecha);
                    if (!paroDate) continue;

                    const paroStartTime = parseTime(paro.hora_paro);
                    const paroDateTime = new Date(paroDate);
                    paroDateTime.setHours(paroStartTime.hours, paroStartTime.minutes, 0, 0);

                    // Verificar si el paro está dentro del rango del batch
                    if (paroDateTime >= batchStart && paroDateTime < batchEnd) {
                        const minutes = parseFloat(paro.diferencia_minutos) || 0;
                        
                        const isProgrammed = paro.paro_programado && 
                                            paro.paro_programado.trim() !== '' &&
                                            paro.paro_programado.toLowerCase() === 'si';
                        
                        if (isProgrammed) {
                            downtimeScheduled += minutes;
                        } else {
                            downtimeNotScheduled += minutes;
                        }
                    }
                }

                const totalDowntime = downtimeScheduled + downtimeNotScheduled;
                const availableMinutes = Math.max(0, durationMinutes - totalDowntime);
                const availableHours = availableMinutes / 60;

                // Piezas esperadas
                const expectedPieces = availableHours * RATE_PER_HOUR;

                // Disponibilidad = (tiempo total - tiempo de paros) / tiempo total
                const disponibilidad = durationMinutes > 0 
                    ? availableMinutes / durationMinutes
                    : 0;

                // Eficiencia = piezas producidas / piezas esperadas
                const eficiencia = expectedPieces > 0 
                    ? totalPieces / expectedPieces 
                    : 0;

                // Calidad = piezas buenas / piezas totales
                const calidad = totalPieces > 0 
                    ? eolOk / totalPieces 
                    : 0;

                // OEE = Disponibilidad × Eficiencia × Calidad
                const oee = disponibilidad * eficiencia * calidad;

                return {
                    batchId: batch.batchId,
                    pn: batch.pn,
                    date: batch.date,
                    startTime: batchStart.toISOString(),
                    endTime: batchEnd.toISOString(),
                    weekday: batch.weekday,
                    week: batch.week,
                    shift: batch.shift.name,
                    productionTime: Math.round(durationMinutes),
                    scheduleTime: Math.round(durationMinutes - downtimeScheduled),
                    downtimeScheduled: Math.round(downtimeScheduled),
                    downtimeNotScheduled: Math.round(downtimeNotScheduled),
                    partsProduced: totalPieces,
                    eolOk: eolOk,
                    eolNok: eolNok,
                    disponibilidad: parseFloat((disponibilidad * 100).toFixed(2)),
                    eficiencia: parseFloat((eficiencia * 100).toFixed(2)),
                    calidad: parseFloat((calidad * 100).toFixed(2)),
                    oee: parseFloat((oee * 100).toFixed(2))
                };
            }).filter(batch => batch.partsProduced > 0); // Solo batches con producción

            console.log('=== FIN production-summary SUCCESS ===');
            res.json({
                success: true,
                data: summaryData,
                count: summaryData.length
            });

        } catch (err) {
            console.error('ERROR en production-summary:', err);
            res.status(500).json({
                success: false,
                message: 'Error al generar resumen de producción',
                error: err.message
            });
        }
    });

    return router;
};
