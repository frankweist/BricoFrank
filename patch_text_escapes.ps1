# patch_text_escapes.ps1
$ErrorActionPreference='Stop'
Set-Location 'C:\gestor-reparaciones\apps\web'

@'
import { useState } from "react"
import { crearOrdenCompleta } from "../../domain/services"

type EquipoForm = {
  categoria: string
  marca: string
  modelo: string
  numeroSerie: string
  descripcion: string
}

export function Registro({ onCreated }:{ onCreated:(ordenId:string)=>void }){
  const [cliente, setCliente] = useState({ nombre:"", telefono:"", email:"" })
  const [equipos, setEquipos] = useState<EquipoForm[]>([
    { categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" }
  ])

  const can =
    !!cliente.nombre &&
    !!cliente.telefono &&
    equipos.every(e => e.marca && e.modelo && e.descripcion)

  function updateEq(i:number, patch:Partial<EquipoForm>){
    setEquipos(prev => prev.map((e,idx)=> idx===i ? { ...e, ...patch } : e))
  }
  function addEquipo(){
    setEquipos(prev => [...prev, { categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" }])
  }
  function removeEquipo(i:number){
    setEquipos(prev => prev.length>1 ? prev.filter((_,idx)=>idx!==i) : prev)
  }

  async function crearOrdenes(){
    if(!can) return
    const ordenIds:string[] = []
    for(const e of equipos){
      const { orden } = await crearOrdenCompleta({
        cliente: { nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email || undefined },
        equipo:   { categoria: e.categoria, marca: e.marca, modelo: e.modelo, numeroSerie: e.numeroSerie || undefined, descripcion: e.descripcion }
      })
      ordenIds.push(orden.id)
    }
    onCreated(ordenIds[0])
  }

  const categorias = ["M\u00F3viles","Ordenadores","Consolas","Televisores","Placas","Robots","Bater\u00EDas","Otros"]

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        <h2 className="text-lg font-semibold">{"Registro cliente y aparatos"}</h2>

        {/* Cliente */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={"Nombre*"}>
            <input className="input" value={cliente.nombre} onChange={e=>setCliente({...cliente, nombre:e.target.value})}/>
          </Field>
          <Field label={"Tel\u00E9fono*"}>
            <input className="input" value={cliente.telefono} onChange={e=>setCliente({...cliente, telefono:e.target.value})}/>
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
                <Field label={"Categor\u00EDa"}>
                  <select className="input" value={eq.categoria} onChange={e=>updateEq(i,{categoria:e.target.value})}>
                    {categorias.map(x=> <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label={"Marca*"}>
                  <input className="input" value={eq.marca} onChange={e=>updateEq(i,{marca:e.target.value})}/>
                </Field>
                <Field label={"Modelo*"}>
                  <input className="input" value={eq.modelo} onChange={e=>updateEq(i,{modelo:e.target.value})}/>
                </Field>
                <Field label={"N\u00BA de serie"}>
                  <input className="input" value={eq.numeroSerie} onChange={e=>updateEq(i,{numeroSerie:e.target.value})}/>
                </Field>
              </div>
              <Field label={"Da\u00F1o inicial*"}>
                <textarea className="input min-h-28" value={eq.descripcion} onChange={e=>updateEq(i,{descripcion:e.target.value})}/>
              </Field>
            </div></div>
          ))}
          <div><button className="btn" onClick={addEquipo}>{"A\u00F1adir otro equipo"}</button></div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!can} onClick={crearOrdenes}>Crear orden(es)</button>
          <button className="btn" onClick={()=>{
            setCliente({ nombre:"", telefono:"", email:"" })
            setEquipos([{ categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" }])
          }}>Limpiar</button>
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
'@ | Set-Content src\modules\registro\Registro.tsx -Encoding utf8

# Limpia caché de vite y arranca
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev
