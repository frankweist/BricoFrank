import React, { useState, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { crearOrdenCompleta, crearOrdenesMultiples } from "../../domain/services"
import { Cliente } from "../../data/types"; 

// --- 1. Tipos y Estados Iniciales ---
type EquipoForm = {
  categoria: string // Se mantiene 'categoria' para el backend, pero en el UI será 'Aparato'
  marca: string
  modelo: string
  numeroSerie: string
  descripcion: string
}

type ClienteForm = Pick<Cliente, 'nombre' | 'telefono' | 'email'> & { 
  id: string | undefined; 
};

const initialCliente: ClienteForm = { id: undefined, nombre: "", telefono: "", email: "" };
const initialEquipo: EquipoForm = { categoria: '', marca: '', modelo: '', numeroSerie: '', descripcion: '' }; // 🔑 CORRECCIÓN: initialCategoria ahora es cadena vacía


// ----------------------------------------------------------------
// 2. FUNCIÓN DE COMPONENTE PRINCIPAL
// ----------------------------------------------------------------
export function Registro({ onCreated }: { onCreated: (id: string) => void }) {
  const [cliente, setCliente] = useState<ClienteForm>(initialCliente)
  const [equipos, setEquipos] = useState<EquipoForm[]>([{ ...initialEquipo }])
  
  const allClientes = useLiveQuery(() => db.clientes.toArray(), []);

  // Lógica de Carga de Cliente Existente (UPSERT) - Omitida para brevedad
  useEffect(() => {
    if (cliente.telefono && cliente.telefono.length >= 9 && allClientes) {
      const existingClient = allClientes.find(c => c.telefono === cliente.telefono);
      
      if (existingClient && existingClient.id !== cliente.id) {
        setCliente({
          id: existingClient.id,
          nombre: existingClient.nombre,
          telefono: existingClient.telefono,
          email: existingClient.email || "",
        });
      }
    }
    
    if (cliente.id && cliente.telefono) {
        const currentClient = allClientes?.find(c => c.id === cliente.id);
        if (currentClient && currentClient.telefono !== cliente.telefono) {
            setCliente(prev => ({ ...prev, id: undefined })); 
        }
    } else if (!cliente.telefono && cliente.id) {
       setCliente(prev => ({ ...prev, id: undefined, nombre: '', email: '' }));
    }
  }, [cliente.telefono, allClientes]);

  // 🔑 Lógica de validación actualizada: ahora 'categoria' (aparato) es obligatoria.
  const can =
    !!cliente.nombre &&
    !!cliente.telefono &&
    equipos.every(e => e.categoria && e.marca && e.modelo && e.descripcion)

  function updateEq(i:number, patch:Partial<EquipoForm>){
    setEquipos(prev => prev.map((e,idx)=> idx===i ? { ...e, ...patch } : e))
  }
  function addEquipo(){
    setEquipos(prev => [...prev, { ...initialEquipo }])
  }
  function removeEquipo(i:number){
    setEquipos(prev => prev.length>1 ? prev.filter((_,idx)=>idx!==i) : prev)
  }

  function cleanForm(){
    setCliente({ ...initialCliente })
    setEquipos([{ ...initialEquipo }])
  }

  async function crearOrdenes(){
    if(!can) return

    const clienteData = { 
        id: cliente.id || undefined, 
        nombre: cliente.nombre, 
        telefono: cliente.telefono, 
        email: cliente.email || undefined 
    };

    if(equipos.length === 1){
      const e = equipos[0]
      const { orden } = await crearOrdenCompleta({
        cliente: clienteData,
        equipo:{ categoria:e.categoria, marca:e.marca, modelo:e.modelo, numeroSerie:e.numeroSerie || undefined, descripcion:e.descripcion }
      })
      cleanForm()
      onCreated(orden.id)
      return
    }

    const { resultados } = await crearOrdenesMultiples({
      cliente: clienteData,
      equipos: equipos.map(e=>({
        categoria:e.categoria, marca:e.marca, modelo:e.modelo,
        numeroSerie:e.numeroSerie || undefined, descripcion:e.descripcion
      }))
    })
    cleanForm()
    onCreated(resultados[0].orden.id)
  }

  // Las categorías ya no son necesarias para el desplegable.

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        <h2 className="text-lg font-semibold">{"Registro cliente y aparatos"}</h2>

        {/* Cliente */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={"Nombre*"}>
            <input className="input" value={cliente.nombre} onChange={e=>setCliente({...cliente, nombre:e.target.value})}/>
            {cliente.id && <span className="text-xs text-green-500">Cliente existente (ID: {cliente.id.substring(0, 4)}...)</span>}
          </Field>
          <Field label={"Teléfono*"}>
            <input className="input" type="tel" value={cliente.telefono} onChange={e=>setCliente({...cliente, telefono:e.target.value})}/>
          </Field>
          <Field label={"Email"}>
            <input className="input" type="email" value={cliente.email || ''} onChange={e=>setCliente({...cliente, email:e.target.value})}/>
          </Field>
        </div>

        {/* Equipos */}
        <div className="grid gap-4">
          {equipos.map((eq,i)=>(
            <div key={i} className="card"><div className="card-body grid gap-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">Equipo #{i+1}</div>
                {equipos.length>1 && (
                  <button className="btn" onClick={()=>removeEquipo(i)}>Quitar</button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {/* 🔑 CAMBIO 1: Se cambia la etiqueta a "Aparato*" */}
                <Field label={"Aparato*"}> 
                  {/* 🔑 CAMBIO 2: Se usa un input de texto libre en lugar de un select */}
                  <input 
                    className="input w-full" 
                    value={eq.categoria} // 🔑 Se usa la propiedad 'categoria' para guardar el valor
                    onChange={e=>updateEq(i,{categoria:e.target.value})}
                    placeholder="Ej: Móvil, Portátil, Consola PS5, etc."
                  />
                </Field>
                <Field label={"Marca*"}>
                  <input className="input" value={eq.marca} onChange={e=>updateEq(i,{marca:e.target.value})}/>
                </Field>
                <Field label={"Modelo*"}>
                  <input className="input" value={eq.modelo} onChange={e=>updateEq(i,{modelo:e.target.value})}/>
                </Field>
                <Field label={"Nº de serie"}>
                  <input className="input" value={eq.numeroSerie} onChange={e=>updateEq(i,{numeroSerie:e.target.value})}/>
                </Field>
              </div>
              <Field label={"Daño inicial*"}>
                <textarea className="input min-h-28" value={eq.descripcion} onChange={e=>updateEq(i,{descripcion:e.target.value})}/>
              </Field>
            </div></div>
          ))}
          <div><button className="btn" onClick={addEquipo}>{"Añadir otro equipo"}</button></div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!can} onClick={crearOrdenes}>Crear orden(es)</button>
          <button className="btn" onClick={cleanForm}>Limpiar</button>
        </div>
      </div></div>
    </section>
  )
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <label className="grid gap-1">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
      {children}
    </label>
  )
}