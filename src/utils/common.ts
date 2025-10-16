// src/utils/common.ts

// Lista canónica de estados de la orden para uso en filtros y selectores de UI
export const ESTADOS_ORDEN_LIST = ['todos', 'recepcion', 'diagnostico', 'reparacion', 'listo', 'entregado'] as const;

// Función para seleccionar campos específicos de un objeto
export function pickJSON<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const newObj = {} as Pick<T, K>;
    keys.forEach(key => {
        newObj[key] = obj[key];
    });
    return newObj;
}

// Función para exportar datos a CSV
export function toCSV(data: any[]): string {
    if (data.length === 0) return '';

    // 1. Obtener encabezados
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    // 2. Formatear filas
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            // Manejar valores null/undefined
            let stringVal = (val === null || val === undefined) ? '' : String(val);
            
            // Escapar comillas dobles y envolver el valor si contiene comas, comillas o saltos de línea
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                stringVal = stringVal.replace(/"/g, '""'); 
                stringVal = `"${stringVal}"`; 
            }
            return stringVal;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}