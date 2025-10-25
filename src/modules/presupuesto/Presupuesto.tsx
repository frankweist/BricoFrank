// Archivo: Presupuesto.tsx (V2.1 - Conexión de Datos y Lógica Completa)

import { useState, useEffect, useCallback, ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks"; 
import { db } from "../../data/db"; 

type Pieza = {
  nombre: string;
  precio: number; 
};

type Orden = { 
  id: string, 
  presupuestoAprox: number | null,
  horasReparacion: number,
  tarifa: number,
  piezas: any[],
  precioNuevo: number | null,
  precioSegundaMano: number | null,
  cliente: { nombre: string, telefono: string }, 
  equipo: { categoria: string, marca: string, modelo: string, numeroSerie?: string, descripcion: string } 
};

// --- Componentes de utilidad ---

function KPI({label, value, strong}:{label:string; value:number; strong?:boolean}){
  return (<div className="card"><div className="card-body">
    <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    <div className={`text-xl ${strong?'font-bold':''}`}>{value.toFixed(2)}</div>
  </div></div>)
}
function Field({label, children}:{label:string; children:ReactNode}){
  return (<label className="grid gap-1"><span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>{children}</label>)
}

// Función para estimar horas
const estimarHoras = (aparato: string = '', dano: string = ''): number => {
  let horasBase = 1.0;
  const danoLower = dano.toLowerCase();
  const aparatoLower = aparato.toLowerCase();

  if (aparatoLower.includes("móvil")) horasBase = 1.5;
  else if (aparatoLower.includes("ordenador")) horasBase = 2.0;
  else if (aparatoLower.includes("placa") || danoLower.includes("líquido")) horasBase = 3.0;
  
  if (danoLower.includes("pantalla") || danoLower.includes("batería")) horasBase += 0.5;
  if (danoLower.includes("componente") || danoLower.includes("soldadura")) horasBase += 1.0;
  
  return Math.max(0.5, Math.round(horasBase * 2) / 2); 
};


export function Presupuesto({ ordenId }: { ordenId: string | undefined }){ // 🔑 Recibe ordenId
  // 1. Carga los datos de la orden
  const orden = useLiveQuery(
    () => ordenId ? db.ordenes.get(ordenId) : Promise.resolve(undefined), 
    [ordenId]
  ) as Orden | undefined;
  
  // 2. Estados para los datos de cálculo
  const [piezas, setPiezas] = useState<Pieza[]>([{ nombre: "", precio: 0 }]);
  const [horasReparacion, setHorasReparacion] = useState<number>(0);
  const [precioNuevo, setPrecioNuevo] = useState<number | ''>('');
  const [precioSegundaMano, setPrecioSegundaMano] = useState<number | ''>('');
  const [tarifa,setTarifa]=useState(25); 
  const [presupuestoAprox, setPresupuestoAprox] = useState<number | null>(null);

  // Parámetros de negocio
  const margenPiezas = 1.15; 
  const topeSegundaManoFactor = 0.8; 

  // FUNCIÓN DE GUARDADO AUTOMÁTICO
  const guardarCambios = useCallback(async (dataToSave: any) => {
    if (!ordenId) return;
    try {
      await db.ordenes.update(ordenId, {
        piezas: dataToSave.piezas,
        horasReparacion: dataToSave.horasReparacion,
        precioNuevo: dataToSave.precioNuevo,
        precioSegundaMano: dataToSave.precioSegundaMano,
        tarifa: dataToSave.tarifa,
        presupuestoAprox: dataToSave.presupuestoAprox,
        actualizada: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error guardando presupuesto:", error);
    }
  }, [ordenId]);
  
  
  // EFECTO 1: Carga los datos del presupuesto guardado si existen
  useEffect(() => {
    if (orden) {
      // Cargamos valores defensivos
      const initialPiezas = orden.piezas && orden.piezas.length > 0 ? orden.piezas : [{ nombre: "", precio: 0 }];
      setPiezas(initialPiezas);
      setTarifa(orden.tarifa || 25);
      setPrecioNuevo(orden.precioNuevo ?? '');
      setPrecioSegundaMano(orden.precioSegundaMano ?? '');
      setPresupuestoAprox(orden.presupuestoAprox ?? null);

      if (orden.horasReparacion) {
        setHorasReparacion(orden.horasReparacion);
      } else if (orden.equipo) {
        // Genera horas estimadas por defecto si no existen
        setHorasReparacion(estimarHoras(orden.equipo.categoria, orden.equipo.descripcion));
      }
    } else {
        // Restablecer si no hay orden seleccionada
        setPiezas([{ nombre: "", precio: 0 }]);
        setHorasReparacion(0);
        setPrecioNuevo('');
        setPrecioSegundaMano('');
        setTarifa(25);
        setPresupuestoAprox(null);
    }
  }, [orden]); 

  // EFECTO 2: Guarda los cambios cada vez que estos estados se actualizan
  useEffect(() => {
    // Solo guardar si hay una orden y se han calculado las horas
    if (!orden || horasReparacion === 0) return; 

    const dataToSave = {
      // Solo guardar piezas que tienen nombre o precio
      piezas: piezas.filter(p => p.nombre || p.precio > 0), 
      horasReparacion,
      precioNuevo: precioNuevo === '' ? null : Number(precioNuevo),
      precioSegundaMano: precioSegundaMano === '' ? null : Number(precioSegundaMano),
      tarifa,
      presupuestoAprox
    }
    
    guardarCambios(dataToSave);
  }, [piezas, horasReparacion, precioNuevo, precioSegundaMano, tarifa, presupuestoAprox, orden, guardarCambios]);


  // Manejadores de estado (addPieza, removePieza, updatePieza)
  const addPieza = () => setPiezas(prev => [...prev, { nombre: "", precio: 0 }]);
  const removePieza = (i: number) => setPiezas(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  const updatePieza = (i: number, patch: Partial<Pieza>) => {
    setPiezas(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  };

  const generarHorasEstimadas = useCallback(() => {
    if (orden?.equipo) {
      const { categoria, descripcion } = orden.equipo;
      const estimado = estimarHoras(categoria, descripcion);
      setHorasReparacion(estimado);
    }
  }, [orden]);

  // Lógica del cálculo
  const calcularPresupuesto = () => {
    if (!orden || !orden.equipo || horasReparacion <= 0) {
        setPresupuestoAprox(null);
        return;
    }

    const costoManoObra = horasReparacion * tarifa;
    // Solo sumar piezas con nombre o precio > 0
    const piezasValidas = piezas.filter(p => p.nombre || p.precio > 0);
    const costoPiezasBruto = piezasValidas.reduce((sum, p) => sum + p.precio, 0);
    const costoPiezasConMargen = costoPiezasBruto * margenPiezas;
    let total = costoManoObra + costoPiezasConMargen;

    const segMano = Number(precioSegundaMano) || 0;
    if (segMano > 0) {
      const topeMaximo = segMano * topeSegundaManoFactor; 
      if (total > topeMaximo) {
        total = topeMaximo; 
      }
    }
    
    const resultado = Math.round(total * 100) / 100;
    setPresupuestoAprox(resultado);
  };
  // --------------------------------------------------------------------

  // === VALIDACIONES INICIALES ===
  if (!ordenId) {
      return <div className="card"><div className="card-body">Selecciona una orden desde **"Órdenes"** para presupuestar.</div></div>;
  }
  if (!orden) {
      return <p className="text-sm opacity-70">Cargando detalles de la orden (ID: {ordenId})...</p>;
  }
  if (!orden.cliente || !orden.equipo) {
      return <p className="text-sm text-red-500">No se encontraron detalles completos (cliente/equipo) para la orden {ordenId}.</p>;
  }
  // === FIN VALIDACIONES INICIALES ===

  const { cliente, equipo } = orden;
  const costoPiezasBruto = piezas.filter(p => p.nombre || p.precio > 0).reduce((sum, p) => sum + p.precio, 0);
  const costoPiezasConMargen = costoPiezasBruto * margenPiezas;
  const manoObra = horasReparacion * tarifa;
  const subtotal = manoObra + costoPiezasConMargen;

  // Piezas válidas para la validación del botón
  const piezasValidas = piezas.filter(p => p.nombre || p.precio > 0);
  // Condición para deshabilitar el botón de cálculo
  const disableCalculate = horasReparacion <= 0 || !piezasValidas.every(p => p.nombre && p.precio >= 0);


  return (
    <section className="grid gap-4">
      {/* DATOS DEL CLIENTE Y EQUIPO EN PRESUPUESTO */}
      <div className="card">
        <div className="card-body grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold">Cliente</h2>
            <p><strong>Nombre:</strong> {cliente.nombre}</p>
            <p><strong>Teléfono:</strong> {cliente.telefono}</p>
          </div>
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold">Equipo</h2>
            <p><strong>Aparato:</strong> {equipo.categoria}</p>
            <p><strong>Marca/Modelo:</strong> {equipo.marca} {equipo.modelo}</p>
            <p><strong>Daño:</strong> {equipo.descripcion}</p>
          </div>
        </div>
      </div>
      {/* ------------------------------------------- */}

      <div className="card"><div className="card-body grid gap-4">
        {/* Título de la sección de cálculo */}
        <h2 className="text-lg font-semibold">Cálculo de Presupuesto para: {equipo.categoria}</h2>
        
        <hr className="my-2"/>
        
        {/* Horas de Reparación */}
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Field label={"Tarifa €/h"}>
            <input type="number" className="input" value={tarifa} onChange={e=>setTarifa(parseFloat(e.target.value)||0)}/>
          </Field>
          <Field label={"Horas de Reparación (Manual)*"}>
            <input 
                type="number" 
                step="0.5" 
                min="0"
                className="input" 
                value={horasReparacion || ''} 
                onChange={e=>setHorasReparacion(Number(e.target.value) || 0)}
            />
          </Field>
          <div className="col-span-2">
            <button className="btn w-full" onClick={generarHorasEstimadas}>
              Generar Horas Estimadas ({estimarHoras(equipo.categoria, equipo.descripcion)}h)
            </button>
          </div>
          <div className="sm:col-span-4 text-xs opacity-70">
            Costo de mano de obra calculado: **{manoObra.toFixed(2)} €**
          </div>
        </div>

        <hr className="my-2"/>

        {/* CAMPOS NUEVOS: Precio Nuevo / Segunda Mano */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={"Precio del aparato nuevo (€)"}>
            <input 
                type="number" 
                min="0"
                className="input" 
                value={precioNuevo} 
                onChange={e=>setPrecioNuevo(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </Field>
          <Field label={`Precio de segunda mano (Tope: ${Math.round(topeSegundaManoFactor * 100)}% del valor - €)`}>
            <input 
                type="number" 
                min="0"
                className="input" 
                value={precioSegundaMano} 
                onChange={e=>setPrecioSegundaMano(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </Field>
        </div>

        <hr className="my-2"/>

        {/* Piezas */}
        <h3 className="text-md font-semibold mt-2">Piezas necesarias (Margen {Math.round(margenPiezas * 100 - 100)}%)</h3>
        {piezas.map((p, i) => (
          <div key={i} className="grid sm:grid-cols-[2fr_1fr_auto] gap-3 items-end">
            <Field label={`Pieza ${i + 1} - Nombre*`}>
              <input className="input" value={p.nombre} onChange={e=>updatePieza(i,{nombre:e.target.value})}/>
            </Field>
            <Field label={`Precio sin IVA (€)*`}>
              <input type="number" min="0" step="0.01" className="input" 
                value={p.precio || ''} 
                onChange={e=>updatePieza(i,{precio:Number(e.target.value)})}
              />
            </Field>
            {piezas.length > 0 ? (
              <button className="btn" onClick={() => removePieza(i)}>Quitar</button>
            ) : (
              <div className="h-10 w-16"></div> 
            )}
          </div>
        ))}
        <div>
            <button className="btn" onClick={addPieza}>➕ Añadir otra pieza</button>
        </div>

        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
            <KPI label="Costo Piezas (s/ IVA)" value={costoPiezasBruto}/>
            <KPI label="Costo Piezas (c/ Margen)" value={costoPiezasConMargen}/>
            <KPI label="Mano de Obra" value={manoObra}/>
            <KPI label="Subtotal (Piezas + M.O.)" value={subtotal} strong/>
        </div>

        <hr className="my-2"/>

        {/* Acciones y Resultado */}
        <div className="flex gap-4 items-center justify-between mt-4">
            <button 
                className="btn btn-primary" 
                onClick={calcularPresupuesto}
                disabled={disableCalculate}
            >
                Calcular Presupuesto Aproximado
            </button>
            
            {presupuestoAprox !== null && (
                <div className="text-xl font-bold p-3 bg-indigo-100 text-indigo-800 rounded-lg shadow-lg">
                    Total Presupuesto: {presupuestoAprox.toFixed(2)} €
                    {(precioSegundaMano && presupuestoAprox === Number(precioSegundaMano) * topeSegundaManoFactor) && (
                        <p className="text-xs font-normal mt-1 text-indigo-600">
                            (Limitado por tope de Segunda Mano)
                        </p>
                    )}
                </div>
            )}
        </div>
      </div></div>
    </section>
  )
}