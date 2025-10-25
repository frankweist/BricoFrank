import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db'; 
// 🔑 Se asume que estos tipos existen en tu proyecto
import { EstadoOrden, Orden } from '../../data/types'; 
import { TrendingUp, Clock, CheckCircle, Package } from 'lucide-react'; 

// --- Utilidades ---
const today = new Date();
const formatIsoDate = (date: Date) => date.toISOString().split('T')[0];
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const todosLosEstados: EstadoOrden[] = ['recepcion', 'diagnostico', 'presupuesto', 'reparacion', 'listo', 'entregado'];

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
    end.setDate(end.getDate() + 1);
    const endTimestamp = end.getTime();

    return todasLasOrdenes.filter(orden => {
      const creadaTimestamp = new Date(orden.creada).getTime(); 
      return creadaTimestamp >= start && creadaTimestamp < endTimestamp;
    });
  }, [todasLasOrdenes, fechaInicio, fechaFin]);

  // 3. Calcular métricas clave
  const metricas = useMemo(() => {
    const conteoPorEstado: Record<EstadoOrden, number> = todosLosEstados.reduce((acc, estado) => ({ ...acc, [estado]: 0 }), {} as Record<EstadoOrden, number>);
    let totalEntregadas = 0;
    let ingresosEstimados = 0;
    
    const ordenesParaCalculo = ordenesFiltradas.filter(o => o.estado === 'entregado');

    for (const orden of ordenesFiltradas) {
      if (conteoPorEstado[orden.estado as EstadoOrden] !== undefined) {
        conteoPorEstado[orden.estado as EstadoOrden]++;
      }
      
      if (orden.estado === 'entregado') {
        totalEntregadas++;
      }
    }
    
    for (const orden of ordenesParaCalculo) {
        if (orden.presupuestoAprox && orden.presupuestoAprox > 0) {
            ingresosEstimados += orden.presupuestoAprox;
        }
    }


    return {
      totalOrdenes: ordenesFiltradas.length,
      totalEntregadas: totalEntregadas,
      conteoPorEstado,
      ingresosEstimados: ingresosEstimados,
    };
  }, [ordenesFiltradas]);


  // Componente auxiliar para mostrar métricas
  function MetricCard({ title, value, Icon, isSmall = false }: { title: string; value: string | number; Icon: any; isSmall?: boolean }) {
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

  // --- Renderizado ---
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Informes y Estadísticas</h1>

      {/* 1. Filtro de Fechas */}
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
      
      {/* 2. Métricas Clave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Órdenes Totales" value={metricas.totalOrdenes} Icon={Package} />
        <MetricCard title="Órdenes Entregadas" value={metricas.totalEntregadas} Icon={CheckCircle} />
        <MetricCard title="Órdenes Pendientes" value={metricas.totalOrdenes - metricas.totalEntregadas} Icon={Clock} />
        <MetricCard title="Ingresos (Est. Entregadas)" value={`${metricas.ingresosEstimados.toFixed(2)} €`} Icon={TrendingUp} /> 
      </div>

      {/* 3. Conteo por Estado */}
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