import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db'; // Asume que la base de datos está aquí
import { EstadoOrden, Orden } from '../../data/types'; // Importa los tipos de datos

// --- Utilidades ---
const today = new Date();
const formatIsoDate = (date: Date) => date.toISOString().split('T')[0];
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

// Estado de Ordenes para contar (omitiendo el estado final 'entregado' por defecto)
const estadosConteo: EstadoOrden[] = ['recepcion', 'diagnostico', 'reparacion', 'listo'];

// --- Componente Principal ---
export function Informes() {
  const [fechaInicio, setFechaInicio] = useState(formatIsoDate(yesterday));
  const [fechaFin, setFechaFin] = useState(formatIsoDate(today));

  // 1. Obtener todas las órdenes de la DB
  const todasLasOrdenes = useLiveQuery(() => db.ordenes.toArray(), [], []);

  // 2. Filtrar órdenes por rango de fecha de creación (creada)
  const ordenesFiltradas = useMemo(() => {
    if (!todasLasOrdenes) return [];

    const start = new Date(fechaInicio).getTime();
    const end = new Date(fechaFin);
    // Ajustar la fecha final para incluir todo el día
    end.setDate(end.getDate() + 1);
    const endTimestamp = end.getTime();

    return todasLasOrdenes.filter(orden => {
      const creadaTimestamp = new Date(orden.creada).getTime();
      return creadaTimestamp >= start && creadaTimestamp < endTimestamp;
    });
  }, [todasLasOrdenes, fechaInicio, fechaFin]);

  // 3. Calcular métricas clave
  const metricas = useMemo(() => {
    const conteoPorEstado: Record<EstadoOrden, number> = {
      recepcion: 0,
      diagnostico: 0,
      reparacion: 0,
      listo: 0,
      entregado: 0,
    };

    let totalEntregadas = 0;
    
    // Suponiendo que tienes un campo de costo total en la orden (orden.costoTotal)
    // Ya que no lo tengo en types.ts, lo omitiré o usaré un placeholder si es necesario.
    let ingresosEstimados = 0; 
    
    ordenesFiltradas.forEach(orden => {
      conteoPorEstado[orden.estado] += 1;
      if (orden.estado === 'entregado') {
        totalEntregadas += 1;
        // Si Orden tuviera un campo 'costoTotal' podrías sumarlo aquí:
        // ingresosEstimados += orden.costoTotal || 0; 
      }
    });

    return {
      totalOrdenes: ordenesFiltradas.length,
      totalEntregadas,
      conteoPorEstado,
      ingresosEstimados,
    };
  }, [ordenesFiltradas]);

  // --- Renderizado ---
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Informes y Estadísticas</h1>

      {/* 1. Filtro de Fechas */}
      <div className="card">
        <div className="card-body grid sm:grid-cols-3 gap-4 items-end">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Fecha Inicio:</span>
            <input 
              type="date" 
              className="input" 
              value={fechaInicio} 
              onChange={(e) => setFechaInicio(e.target.value)} 
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Fecha Fin:</span>
            <input 
              type="date" 
              className="input" 
              value={fechaFin} 
              onChange={(e) => setFechaFin(e.target.value)} 
            />
          </label>
          <p className="text-sm opacity-70">Mostrando datos de órdenes creadas entre estas fechas.</p>
        </div>
      </div>

      {/* 2. Métricas Clave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Órdenes Totales (Período)" value={metricas.totalOrdenes} />
        <MetricCard title="Órdenes Entregadas" value={metricas.totalEntregadas} />
        <MetricCard title="Órdenes Pendientes" value={metricas.totalOrdenes - metricas.totalEntregadas} />
        {/* Usar un valor fijo o calculado si tienes la data */}
        <MetricCard title="Ingresos (Est.)" value={`$${metricas.ingresosEstimados.toFixed(2)}`} /> 
      </div>

      {/* 3. Conteo por Estado */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-semibold mb-3">Órdenes por Estado</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {estadosConteo.map(estado => (
              <MetricCard 
                key={estado} 
                title={estado.charAt(0).toUpperCase() + estado.slice(1)} // Capitalizar
                value={metricas.conteoPorEstado[estado]} 
                isSmall={true}
              />
            ))}
            <MetricCard title="Entregado" value={metricas.conteoPorEstado.entregado} isSmall={true} />
          </div>
        </div>
      </div>

    </div>
  );
}

// Componente auxiliar para mostrar métricas
function MetricCard({ title, value, isSmall = false }: { title: string; value: string | number; isSmall?: boolean }) {
  return (
    <div className={`p-4 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 ${isSmall ? '' : 'col-span-1'}`}>
      <p className={`text-sm opacity-70 mb-1 ${isSmall ? 'text-xs' : ''}`}>{title}</p>
      <p className={`font-bold ${isSmall ? 'text-xl' : 'text-3xl'}`}>{value}</p>
    </div>
  );
}