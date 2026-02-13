import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { EstadoOrden } from '../../data/types';
import { TrendingUp, Clock, CheckCircle, Package } from 'lucide-react';

// --- Utilidades ---
const today = new Date();
const formatIsoDate = (date: Date) => date.toISOString().split('T')[0];
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const todosLosEstados: EstadoOrden[] = ['recepcion', 'diagnostico', 'presupuesto', 'reparacion', 'listo', 'entregado'];

// Normaliza y parsea la fecha de creación de una orden, sea cual sea el campo que la contenga
function getFechaCreacion(orden: any): number {
  const f = orden.creada || orden.fecha_creacion;
  return f ? new Date(f).getTime() : 0;
}

// --- Componente Principal ---
export function Informes() {
  const [fechaInicio, setFechaInicio] = useState(formatIsoDate(yesterday));
  const [fechaFin, setFechaFin] = useState(formatIsoDate(today));

  const todasLasOrdenes = useLiveQuery(() => db.ordenes.toArray(), []);

  const ordenesFiltradas = useMemo(() => {
    if (!todasLasOrdenes) return [];

    const start = new Date(fechaInicio).getTime();
    const end = new Date(fechaFin);
    end.setDate(end.getDate() + 1); // Incluir todo el día de fin
    const endTimestamp = end.getTime();

    return todasLasOrdenes.filter(orden => {
      const creadaTimestamp = getFechaCreacion(orden);
      return creadaTimestamp >= start && creadaTimestamp < endTimestamp;
    });
  }, [todasLasOrdenes, fechaInicio, fechaFin]);

  const metricas = useMemo(() => {
    const conteoPorEstado = todosLosEstados.reduce((acc, estado) => ({ ...acc, [estado]: 0 }), {} as Record<EstadoOrden, number>);
    let ingresosEstimados = 0;

    for (const orden of ordenesFiltradas) {
      if (orden.estado && conteoPorEstado[orden.estado as EstadoOrden] !== undefined) {
        conteoPorEstado[orden.estado as EstadoOrden]++;
      }
      if (orden.estado === 'entregado' && orden.presupuestoAprox && orden.presupuestoAprox > 0) {
        ingresosEstimados += orden.presupuestoAprox;
      }
    }
    
    const totalEntregadas = conteoPorEstado['entregado'] || 0;

    return {
      totalOrdenes: ordenesFiltradas.length,
      totalEntregadas,
      conteoPorEstado,
      ingresosEstimados,
    };
  }, [ordenesFiltradas]);


  function MetricCard({ title, value, Icon, isSmall = false }: { title: string; value: string | number; Icon: React.ElementType; isSmall?: boolean }) {
    return (
      <div className={`p-4 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 ${isSmall ? '' : 'col-span-1'}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{title}</p>
          <Icon className="size-5 text-primary-500"/>
        </div>
        <p className={`mt-1 ${isSmall ? 'text-lg' : 'text-3xl font-bold'}`}>{value}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Informes y Estadísticas</h1>

      <div className="card"><div className="card-body">
        <h2 className="text-lg font-semibold mb-3">Rango de Fecha de Creación</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Desde (Creada)</span>
            <input type="date" className="input w-full" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </label>
          <label>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Hasta (Creada)</span>
            <input type="date" className="input w-full" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </label>
        </div>
        <p className="text-sm opacity-70 mt-3">Mostrando datos de {ordenesFiltradas.length} órdenes creadas entre {fechaInicio} y {fechaFin}.</p>
      </div></div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Órdenes Totales" value={metricas.totalOrdenes} Icon={Package} />
        <MetricCard title="Órdenes Entregadas" value={metricas.totalEntregadas} Icon={CheckCircle} />
        <MetricCard title="Órdenes Pendientes" value={metricas.totalOrdenes - metricas.totalEntregadas} Icon={Clock} />
        <MetricCard title="Ingresos (Est. Entregadas)" value={`${metricas.ingresosEstimados.toFixed(2)} €`} Icon={TrendingUp} /> 
      </div>

      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-semibold mb-3">Órdenes por Estado (Total en el Periodo)</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {todosLosEstados.map(estado => (
              <MetricCard 
                key={estado} 
                title={estado.charAt(0).toUpperCase() + estado.slice(1)} 
                value={metricas.conteoPorEstado[estado]} 
                Icon={Package} 
                isSmall={true}
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}