import { useState, useMemo, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { crearOrdenCompleta, crearOrdenesMultiples } from "../../domain/services"

type EquipoForm = {
  // 💡 CAMBIO: 'categoria' se mantiene en el tipo, pero ahora es editable
  categoria: string 
  marca: string
  modelo: string
  numeroSerie: string
  descripcion: string
}

// Estados iniciales para facilitar la limpieza y tipado
// 💡 CAMBIO: El valor inicial de 'categoria' ahora es una cadena vacía (o el valor que prefieras por defecto)
const initialCliente = { id: undefined, nombre: "", telefono: "", email: "" };
const initialEquipo = { categoria: "", marca: "", modelo: "", numeroSerie: "", descripcion: "" }; 
type ClienteForm = typeof initialCliente & { id: string | undefined }; 

export function Registro({ onCreated }:{ onCreated:(ordenId:string)=>void }){
  const [cliente, setCliente] = useState<ClienteForm>(initialCliente) 
  const [equipos, setEquipos] = useState<EquipoForm[]>([{ ...initialEquipo }])
  
  const allClientes = useLiveQuery(() => db.clientes.toArray(), []);

  // ... (Lógica de useEffect para carga de cliente por teléfono se mantiene) ...

  const can =
    !!cliente.nombre &&
    !!cliente.telefono &&
    // 💡 ACTUALIZADO: Ahora 'categoria' (aparato), 'marca', 'modelo' y 'descripcion' son requeridos
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
    setCliente(initialCliente)
    setEquipos([{ ...initialEquipo }])
  }

  async function crearOrdenes(){
    if(!can) return
    // ... (rest of crearOrdenes logic, which doesn't change as it uses e.categoria) ...

    const clienteData = { 
        id: cliente.id, 
        nombre: cliente.nombre, 
        telefono: cliente.telefono, 
        email: cliente.email 
    };

    try {
      if(equipos.length === 1){
        const e = equipos[0]
        const { orden } = await crearOrdenCompleta({
          cliente: clienteData,
          // Se mantiene 'categoria' como nombre de la propiedad
          equipo:{ categoria:e.categoria, marca:e.marca, modelo:e.modelo, numeroSerie:e.numeroSerie || undefined, descripcion:e.descripcion }
        })
        cleanForm()
        onCreated(orden.id)
        return
      }

      const { resultados } = await crearOrdenesMultiples({
        cliente: clienteData,
        equipos: equipos.map(e=>({
          // Se mantiene 'categoria' como nombre de la propiedad
          categoria:e.categoria, marca:e.marca, modelo:e.modelo,
          numeroSerie:e.numeroSerie || undefined, descripcion:e.descripcion
        }))
      })
      cleanForm()
      onCreated(resultados[0].orden.id) 
    } catch(error) {
        console.error("Error al crear la orden:", error);
        alert("Hubo un error al crear la orden. Revisa la consola.");
    }
  }

  // 💡 ELIMINADO: Ya no necesitamos el array 'categorias'

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        <h2 className="text-lg font-semibold">{"Registro cliente y aparatos"}</h2>

        {/* Cliente (Se mantiene sin cambios) */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={"Nombre*"}>
            <input className="input" value={cliente.nombre} onChange={e=>setCliente({...cliente, nombre:e.target.value})}/>
            {cliente.id && <span className="text-xs text-green-500">Cliente existente ID: {cliente.id.substring(0, 4)}...</span>}
          </Field>
          <Field label={"Teléfono*"}>
            <input className="input" value={cliente.telefono} onChange={e=>{
                setCliente(prev => ({...prev, telefono:e.target.value}));
                if (cliente.id && e.target.value !== cliente.telefono) {
                    setCliente(prev => ({...prev, id: undefined, nombre: initialCliente.nombre, email: initialCliente.email}));
                }
            }}/>
          </Field>
          <Field label={"Email"}>
            <input className="input" value={cliente.email} onChange={e=>setCliente({...cliente, email:e.target.value})}/>
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
                
                {/* 💡 CAMBIO DE SELECT A INPUT */}
                <Field label={"Aparato*"}>
                  <input className="input" placeholder="Ej: Móvil, Ordenador, Robot aspirador..." value={eq.categoria} onChange={e=>updateEq(i,{categoria:e.target.value})}/>
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

        {/* Acciones (Se mantiene sin cambios) */}
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