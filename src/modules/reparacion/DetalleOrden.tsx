<<<<<<< Updated upstream
﻿import { useState, useMemo, useEffect, useRef } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "../../data/db"
import { crearOrdenParaCliente } from "../../domain/services"

function fmtBytes(n: number) {
  if (n < 1024) return n + " B"
  const k = 1024, u = ["KB", "MB", "GB", "TB"]
  let i = -1, v = n
  do { v /= k; i++ } while (v >= k && i < u.length - 1)
  return v.toFixed(1) + " " + u[i]
}
const NOTE_TEMPLATES = [
  "Recepción: equipo recibido, sin accesorios.",
  "Diagnóstico: fallo intermitente, se recomienda prueba de carga.",
  "Presupuesto enviado al cliente.",
  "Esperando piezas del proveedor.",
  "Prueba funcional superada.",
  "Listo para entregar."
]
const DIAG_TEMPLATES = [
  "No enciende: verificar fuente, batería y placa principal.",
  "Sobrecalentamiento: limpieza y pasta térmica.",
  "Daño de pantalla: reemplazo LCD previsto.",
  "Puertos dañados: sustitución conector.",
]

type PiezaEstado = "pendiente"|"pedido"|"recibido"|"instalado"
type EquipoForm = { categoria:string; marca:string; modelo:string; numeroSerie?:string; descripcion:string }

export function DetalleOrden({ ordenId }: { ordenId: string }) {
  const [nota, setNota]   = useState("")
  const [pieza, setPieza] = useState({ nombre: "", cantidad: 1, coste: 0, estado: "pendiente" as PiezaEstado })
  const [horas, setHoras] = useState(1)
  const [tarifa, setTarifa] = useState(25)
  const [edit, setEdit]   = useState(false)

  // Nuevo equipo para mismo cliente
  const [addOpen, setAddOpen] = useState(false)
  const [eq, setEq] = useState<EquipoForm>({ categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" })
  const categorias = ["Móviles","Ordenadores","Consolas","Televisores","Placas","Robots","Baterías","Otros"]

  // Toast + undo
  const [toast, setToast] = useState<{msg:string; action?:()=>void}|null>(null)
  const timerRef = useRef<number|undefined>(undefined)
  function showToast(msg:string, undo?:()=>void){
    clearTimeout(timerRef.current)
    setToast({ msg, action: undo })
    timerRef.current = window.setTimeout(()=> setToast(null), 6000)
  }

  useEffect(()=>{
    const t = Number(localStorage.getItem("gr_tarifa")||"")
    if(!Number.isNaN(t) && t>0) setTarifa(t)
    return ()=> clearTimeout(timerRef.current)
  },[])

  const orden   = useLiveQuery(() => ordenId ? db.ordenes.get(ordenId) : undefined, [ordenId])
  const equipo  = useLiveQuery(async () => {
    if(!ordenId) return undefined
    const o = await db.ordenes.get(ordenId); if(!o) return undefined
    return db.equipos.get(o.equipoId)
  }, [ordenId, (orden as any)?.equipoId])
  const cliente = useLiveQuery(async () => {
    if(!equipo) return undefined
    return db.clientes.get(equipo.clienteId)
  }, [equipo?.clienteId])

  const eventos = useLiveQuery(() => ordenId ? db.eventos.where("ordenId").equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])
  const piezas  = useLiveQuery(() => ordenId ? db.piezas.where("ordenId").equals(ordenId).toArray() : Promise.resolve([]), [ordenId])
  const filesRaw= useLiveQuery(() => ordenId ? db.adjuntos.where("ordenId").equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])

  // Dedup adjuntos
  const files = useMemo(()=>{
    const seen = new Set<string>()
    const out:any[] = []
    for(const f of (filesRaw||[])){
      const sig = `${f.nombre}|${f.tam}|${f.fecha}|${f.tipo}`
      if(seen.has(sig)) continue
      seen.add(sig); out.push(f)
    }
    return out
  },[filesRaw])

  const piezasTotal = useMemo(() => (piezas || []).reduce((s, p) => s + (p.coste * p.cantidad), 0), [piezas])
  const manoObra = horas * tarifa
  const total = manoObra + piezasTotal // SIN IVA

  const [cForm, setCForm] = useState({ nombre:"", telefono:"", email:"" })
  const [eForm, setEForm] = useState({ categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" })

  if (!ordenId) return <div className="card"><div className="card-body">Selecciona o crea una orden.</div></div>

  function startEdit(){
    if(!cliente || !equipo) return
    setCForm({ nombre: cliente.nombre||"", telefono: cliente.telefono||"", email: cliente.email||"" })
    setEForm({
      categoria: equipo.categoria||"Otros", marca: equipo.marca||"", modelo: equipo.modelo||"",
      numeroSerie: equipo.numeroSerie||"", descripcion: equipo.descripcion||"",
    })
    setEdit(true)
  }

  async function saveEdit(){
    if(!orden || !cliente || !equipo) return
    if(!cForm.nombre.trim() || !cForm.telefono.trim() || !eForm.marca.trim() || !eForm.modelo.trim() || !eForm.descripcion.trim()) return
    await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.eventos, async ()=>{
      await db.clientes.update(cliente.id, { nombre: cForm.nombre.trim(), telefono: cForm.telefono.trim(), email: cForm.email.trim() || undefined })
      await db.equipos.update(equipo.id, {
        categoria: eForm.categoria, marca: eForm.marca.trim(), modelo: eForm.modelo.trim(),
        numeroSerie: eForm.numeroSerie.trim() || undefined, descripcion: eForm.descripcion.trim()
      })
      await db.ordenes.update(orden.id, { actualizada: new Date().toISOString() })
      await db.eventos.add({ id: crypto.randomUUID(), ordenId: orden.id, tipo: "nota", texto: "Datos de cliente/equipo actualizados", fecha: new Date().toISOString() })
    })
    setEdit(false)
  }

  async function agregarEvento() {
    if (!nota.trim()) return
    await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo: "nota", texto: nota.trim(), fecha: new Date().toISOString() })
    setNota("")
  }
  async function agregarPieza() {
    if (!pieza.nombre.trim() || pieza.cantidad <= 0) return
    await db.piezas.add({ id: crypto.randomUUID(), ordenId, nombre: pieza.nombre.trim(), cantidad: pieza.cantidad, coste: Number(pieza.coste) || 0, estado: pieza.estado })
    setPieza({ nombre: "", cantidad: 1, coste: 0, estado: "pendiente" })
  }
  async function borrarPieza(id: string) {
    const old = await db.piezas.get(id); if(!old) return
    if(!confirm("¿Borrar pieza?")) return
    await db.piezas.delete(id)
    showToast("Pieza eliminada", async ()=>{ await db.piezas.add(old) })
  }
  async function actualizarPieza(id:string, patch: Partial<{nombre:string; cantidad:number; coste:number; estado:PiezaEstado}>){
    await db.piezas.update(id, patch)
  }
  async function cambiarEstado(nuevo: "recepcion" | "diagnostico" | "reparacion" | "listo" | "entregado") {
    await db.ordenes.update(ordenId, { estado: nuevo, actualizada: new Date().toISOString() })
    await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo: "cambio_estado", texto: `Estado: ${nuevo}`, fecha: new Date().toISOString() })
  }
  async function exportarJSON() {
    const payload = {
      clientes: await db.clientes.toArray(),
      equipos: await db.equipos.toArray(),
      ordenes: await db.ordenes.toArray(),
      eventos: await db.eventos.toArray(),
      piezas: await db.piezas.toArray(),
      adjuntos: await db.adjuntos.toArray()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "bricofrank-backup.json"; a.click()
    URL.revokeObjectURL(url)
  }
  async function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const fl = ev.target.files
    if (!fl || !fl.length) return
    for (const f of Array.from(fl)) {
      const id = crypto.randomUUID()
      const arrBuf = await f.arrayBuffer()
      const blob = new Blob([arrBuf], { type: f.type || "application/octet-stream" })
      await db.adjuntos.add({
        id, ordenId, nombre: f.name, tipo: f.type || "application/octet-stream",
        tam: f.size, fecha: new Date().toISOString(), blob
      })
    }
    ev.target.value = ""
  }
  async function borrarAdjunto(id: string) {
    const old = await db.adjuntos.get(id); if(!old) return
    if(!confirm("¿Borrar adjunto?")) return
    await db.adjuntos.delete(id)
    showToast("Adjunto eliminado", async ()=>{ await db.adjuntos.add(old) })
  }
  async function crearOtroEquipo(){
    if(!cliente) return
    if(!eq.marca.trim() || !eq.modelo.trim() || !eq.descripcion.trim()){
      alert("Rellena Marca, Modelo y Descripción")
      return
    }
    const { orden } = await crearOrdenParaCliente({
      clienteId: cliente.id,
      equipo: {
        categoria: eq.categoria,
        marca: eq.marca.trim(),
        modelo: eq.modelo.trim(),
        numeroSerie: (eq.numeroSerie||"").trim() || undefined,
        descripcion: eq.descripcion.trim()
      }
    })
    setEq({ categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" })
    setAddOpen(false)
    showToast(`Orden creada: ${orden.codigo}. Abre desde "\u00D3rdenes".`)
  }
  function setTarifaPreset(v:number){ setTarifa(v); localStorage.setItem("gr_tarifa", String(v)) }
  function addHoras(v:number){ setHoras(h => Math.max(0, +(h+v).toFixed(2))) }
=======
﻿import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "../../data/db"

function fmtBytes(n:number){ if(n<1024) return n+" B"; const k=1024,u=["KB","MB","GB","TB"]; let i=-1,v=n; do{v/=k;i++}while(v>=k&&i<u.length-1); return v.toFixed(1)+" "+u[i] }

export function DetalleOrden({ ordenId }:{ordenId:string}){
  const [nota,setNota]=useState("")
  const [pieza,setPieza]=useState({ nombre:"", cantidad:1, coste:0, estado:"pendiente" as "pendiente"|"pedido"|"recibido"|"instalado" })
  const [horas,setHoras]=useState(1)
  const [tarifa,setTarifa]=useState(25)

  useEffect(()=>{ const t=Number(localStorage.getItem("gr_tarifa")||""); if(!Number.isNaN(t)&&t>0) setTarifa(t) },[])

  const orden   = useLiveQuery(()=> ordenId? db.ordenes.get(ordenId):undefined,[ordenId])
  const equipo  = useLiveQuery(async ()=>{ if(!ordenId) return; const o=await db.ordenes.get(ordenId); if(!o) return; return db.equipos.get(o.equipoId) },[ordenId,(orden as any)?.equipoId])
  const cliente = useLiveQuery(async ()=>{ if(!equipo) return; return db.clientes.get(equipo.clienteId) },[equipo?.clienteId])

  const eventos = useLiveQuery(()=> ordenId? db.eventos.where("ordenId").equals(ordenId).reverse().toArray():Promise.resolve([]),[ordenId])
  const piezas  = useLiveQuery(()=> ordenId? db.piezas.where("ordenId").equals(ordenId).toArray():Promise.resolve([]),[ordenId])
  const files   = useLiveQuery(()=> ordenId? db.adjuntos.where("ordenId").equals(ordenId).reverse().toArray():Promise.resolve([]),[ordenId])

  const piezasTotal = useMemo(()=> (piezas||[]).reduce((s,p)=>s+(p.coste*p.cantidad),0),[piezas])
  const manoObra = horas*tarifa
  const total = manoObra + piezasTotal

  if(!ordenId) return <div className="card"><div className="card-body">Selecciona o crea una orden.</div></div>
>>>>>>> Stashed changes

  // -------- UI --------
  return (
    <section className="grid gap-4">
<<<<<<< Updated upstream
      <div className="card"><div className="card-body grid gap-4">
        {/* ENCABEZADO: Cliente + Equipo + Orden */}
        <div className="grid gap-3">
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="card"><div className="card-body grid gap-1">
              <div className="text-xs opacity-70">Cliente</div>
              <div className="text-sm font-medium">{cliente?.nombre || "—"}</div>
              <div className="text-sm">{cliente?.telefono || "—"}</div>
              {cliente?.email && <div className="text-xs opacity-70 break-all">{cliente.email}</div>}
            </div></div>
            <div className="card"><div className="card-body grid gap-1">
              <div className="text-xs opacity-70">Equipo</div>
              <div className="text-sm font-medium">
                {equipo ? `${equipo.categoria} ${equipo.marca} ${equipo.modelo}` : "—"}
              </div>
              {equipo?.numeroSerie && <div className="text-xs opacity-70">N\u00BA serie: {equipo.numeroSerie}</div>}
              <div className="text-xs opacity-70 line-clamp-2">{equipo?.descripcion}</div>
            </div></div>
            <div className="card"><div className="card-body grid gap-1">
              <div className="text-xs opacity-70">Orden</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">C\u00F3digo: {orden?.codigo || "…"}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border border-neutral-200/70 dark:border-neutral-800">
                  {orden?.estado}
                </span>
              </div>
              <div className="text-xs opacity-70">
                Creada: {orden?.creada ? new Date(orden.creada).toLocaleString() : "—"}
              </div>
              <div className="text-xs opacity-70">
                Act.: {orden?.actualizada ? new Date(orden.actualizada).toLocaleString() : "—"}
              </div>
            </div></div>
          </div>
        </div>

        {/* Barra de acciones */}
        <div className="flex flex-wrap items-center gap-2">
          <select className="input ml-auto max-w-48" value={orden?.estado || "recepcion"} onChange={e => cambiarEstado(e.target.value as any)}>
            {["recepcion", "diagnostico", "reparacion", "listo", "entregado"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={exportarJSON}>Exportar JSON</button>
          <button className="btn" onClick={()=>window.print()}>Imprimir</button>
          {cliente && <button className="btn btn-primary" onClick={()=>setAddOpen(v=>!v)}>{addOpen ? "Cancelar nuevo equipo" : "A\u00F1adir otro equipo"}</button>}
          {!edit && <button className="btn" onClick={startEdit}>Editar datos</button>}
        </div>

        {/* Form para nuevo equipo */}
        {addOpen && (
          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Nuevo equipo para {cliente?.nombre}</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="grid gap-1"><span className="text-sm">Categor\u00EDa</span>
                <select className="input" value={eq.categoria} onChange={e=>setEq({...eq, categoria:e.target.value})}>
                  {categorias.map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label className="grid gap-1"><span className="text-sm">Marca*</span>
                <input className="input" value={eq.marca} onChange={e=>setEq({...eq, marca:e.target.value})}/>
              </label>
              <label className="grid gap-1"><span className="text-sm">Modelo*</span>
                <input className="input" value={eq.modelo} onChange={e=>setEq({...eq, modelo:e.target.value})}/>
              </label>
              <label className="grid gap-1"><span className="text-sm">N\u00BA de serie</span>
                <input className="input" value={eq.numeroSerie} onChange={e=>setEq({...eq, numeroSerie:e.target.value})}/>
              </label>
            </div>
            <label className="grid gap-1"><span className="text-sm">Da\u00F1o inicial*</span>
              <textarea className="input min-h-28" value={eq.descripcion} onChange={e=>setEq({...eq, descripcion:e.target.value})}/>
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={crearOtroEquipo}>Crear orden</button>
              <button className="btn" onClick={()=>{ setAddOpen(false); setEq({ categoria:"Otros", marca:"", modelo:"", numeroSerie:"", descripcion:"" }) }}>Cancelar</button>
            </div>
          </div></div>
        )}

        {/* Edición cliente/equipo */}
        {edit && (
          <div className="card"><div className="card-body grid gap-4">
            <div className="font-medium">Editar cliente y equipo</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="grid gap-1"><span className="text-sm">Nombre*</span>
                <input className="input" value={cForm.nombre} onChange={e=>setCForm({...cForm, nombre:e.target.value})}/>
              </label>
              <label className="grid gap-1"><span className="text-sm">Tel\u00E9fono*</span>
                <input className="input" value={cForm.telefono} onChange={e=>setCForm({...cForm, telefono:e.target.value})}/>
              </label>
              <label className="grid gap-1"><span className="text-sm">Email</span>
                <input className="input" value={cForm.email} onChange={e=>setCForm({...cForm, email:e.target.value})}/>
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="grid gap-1"><span className="text-sm">Categor\u00EDa</span>
                <select className="input" value={eForm.categoria} onChange={e=>setEForm({...eForm, categoria:e.target.value})}>
                  {categorias.map(x=> <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label className="grid gap-1"><span className="text-sm">Marca*</span>
                <input className="input" value={eForm.marca} onChange={e=>setEForm({...eForm, marca:e.target.value})}/>
              </label>
              <label className="grid gap-1"><span className="text-sm">Modelo*</span>
                <input className="input" value={eForm.modelo} onChange={e=>setEForm({...eForm, modelo:e.target.value})}/>
              </label>
              <label className="grid gap-1"><span className="text-sm">N\u00BA de serie</span>
                <input className="input" value={eForm.numeroSerie} onChange={e=>setEForm({...eForm, numeroSerie:e.target.value})}/>
              </label>
            </div>
            <label className="grid gap-1"><span className="text-sm">Da\u00F1o inicial*</span>
              <textarea className="input min-h-28" value={eForm.descripcion} onChange={e=>setEForm({...eForm, descripcion:e.target.value})}/>
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={saveEdit}>Guardar</button>
              <button className="btn" onClick={()=>setEdit(false)}>Cancelar</button>
            </div>
          </div></div>
        )}

        {/* Costes SIN IVA */}
        <div className="card"><div className="card-body grid gap-3">
          <div className="font-medium">Costes (sin IVA)</div>
          <div className="grid sm:grid-cols-4 gap-2">
            <label className="grid gap-1"><span className="text-sm">Horas</span>
              <input className="input" type="number" value={horas} onChange={e => setHoras(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="grid gap-1"><span className="text-sm">Tarifa {"\u20AC"}/h</span>
              <input className="input" type="number" value={tarifa} onChange={e => setTarifa(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="grid gap-1"><span className="text-sm">Mano de obra</span>
              <input className="input" value={manoObra.toFixed(2)} readOnly />
            </label>
            <label className="grid gap-1"><span className="text-sm">Piezas</span>
              <input className="input" value={piezasTotal.toFixed(2)} readOnly />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm opacity-70">Presets tarifa:</span>
            {[20,25,30,35].map(v=>(
              <button key={v} className="btn" onClick={()=>{ setTarifaPreset(v) }}>{v} {"\u20AC"}/h</button>
            ))}
            <span className="ml-4 text-sm opacity-70">Horas r\u00E1pidas:</span>
            {[0.5,1,2].map(v=>(
              <button key={v} className="btn" onClick={()=>addHoras(v)}>+{v}</button>
            ))}
            <button className="btn" onClick={()=>setHoras(0)}>Reiniciar</button>
          </div>
          <div className="text-xl font-bold">Total: {total.toFixed(2)} {"\u20AC"}</div>
        </div></div>

        {/* Timeline */}
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Timeline</div>
            <div className="grid sm:grid-cols-[1fr_auto] gap-2">
              <input className="input" placeholder="Nueva nota" value={nota} onChange={e => setNota(e.target.value)} />
              <button className="btn btn-primary" onClick={agregarEvento}>A\u00F1adir</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input" onChange={e=>{ if(e.target.value){ setNota(n=> (n? n.trim()+" "+e.target.value : e.target.value)); e.target.selectedIndex=0 } }}>
                <option value="">Plantillas de nota</option>
                {NOTE_TEMPLATES.map((t,i)=><option key={i} value={t}>{t}</option>)}
              </select>
              <select className="input" onChange={e=>{ if(e.target.value){ setNota(n=> (n? n.trim()+" "+e.target.value : e.target.value)); e.target.selectedIndex=0 } }}>
                <option value="">Plantillas de diagn\u00F3stico</option>
                {DIAG_TEMPLATES.map((t,i)=><option key={i} value={t}>{t}</option>)}
              </select>
            </div>
            {eventos?.length ? (
              <ul className="text-sm">
                {eventos.map(e => (
                  <li key={e.id}>{new Date(e.fecha).toLocaleString()} {"\u2014"} {e.texto}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin eventos.</p>}
          </div></div>

          {/* Piezas con edición inline */}
          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Piezas</div>
            <div className="grid sm:grid-cols-4 gap-2">
              <input className="input" placeholder="Nombre" value={pieza.nombre} onChange={e => setPieza({ ...pieza, nombre: e.target.value })} />
              <input className="input" type="number" placeholder="Cant." value={pieza.cantidad} onChange={e => setPieza({ ...pieza, cantidad: Math.max(1, parseInt(e.target.value || "1", 10)) })} />
              <input className="input" type="number" placeholder="Coste" value={pieza.coste} onChange={e => setPieza({ ...pieza, coste: parseFloat(e.target.value) || 0 })} />
              <select className="input" value={pieza.estado} onChange={e => setPieza({ ...pieza, estado: e.target.value as PiezaEstado })}>
                {["pendiente", "pedido", "recibido", "instalado"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><button className="btn btn-primary" onClick={agregarPieza}>A\u00F1adir pieza</button></div>

            {piezas?.length ? (
              <ul className="text-sm grid gap-2">
                {piezas.map(p => (
                  <li key={p.id} className="grid gap-2 sm:grid-cols-[1fr_auto] items-center">
                    <div className="grid sm:grid-cols-4 gap-2">
                      <input className="input" value={p.nombre}
                        onChange={e=>actualizarPieza(p.id,{nombre:e.target.value})}/>
                      <input className="input" type="number" value={p.cantidad}
                        onChange={e=>actualizarPieza(p.id,{cantidad: Math.max(1, parseInt(e.target.value||"1",10))})}/>
                      <input className="input" type="number" value={p.coste}
                        onChange={e=>actualizarPieza(p.id,{coste: parseFloat(e.target.value)||0})}/>
                      <select className="input" value={p.estado}
                        onChange={e=>actualizarPieza(p.id,{estado: e.target.value as PiezaEstado})}>
                        {["pendiente","pedido","recibido","instalado"].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <span className="opacity-70">{(p.coste*p.cantidad).toFixed(2)} {"\u20AC"}</span>
                      <button className="btn" onClick={() => borrarPieza(p.id)}>Borrar</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin piezas.</p>}
          </div></div>
        </div>

        {/* Adjuntos */}
        <div className="card"><div className="card-body grid gap-3">
          <div className="font-medium">Adjuntos y fotos</div>
          <input type="file" className="input" multiple onChange={onPickFiles} />
          {files?.length ? (
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
              {files.map(f => {
                const isImg = /^image\//.test(f.tipo)
                const url = URL.createObjectURL(f.blob)
                return (
                  <div key={f.id} className="card"><div className="card-body grid gap-2">
                    <div className="text-sm break-all">{f.nombre}</div>
                    <div className="text-xs opacity-70">{fmtBytes(f.tam)} {"\u2022"} {new Date(f.fecha).toLocaleString()}</div>
                    {isImg ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={f.nombre} className="w-full h-32 object-cover rounded-lg border border-neutral-200/70 dark:border-neutral-800" />
                      </a>
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer" className="btn">Descargar</a>
                    )}
                    <div className="flex gap-2">
                      <a className="btn" href={url} download={f.nombre}>Guardar</a>
                      <button className="btn" onClick={() => borrarAdjunto(f.id)}>Borrar</button>
                    </div>
                  </div></div>
                )
              })}
            </div>
          ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin adjuntos.</p>}
        </div></div>
=======
      {/* CABECERA COMPACTA */}
      <div className="card"><div className="card-body grid sm:grid-cols-3 gap-2">
        <div>
          <div className="text-xs opacity-70">Cliente</div>
          <div className="text-sm">{cliente?.nombre||"-"}</div>
          <div className="text-xs">{cliente?.telefono||""}{cliente?.email? " · "+cliente.email:""}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Equipo</div>
          <div className="text-sm">{[equipo?.categoria,equipo?.marca,equipo?.modelo].filter(Boolean).join(" ")||"-"}</div>
          <div className="text-xs">{equipo?.numeroSerie? "Nº "+equipo.numeroSerie:""}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Orden</div>
          <div className="text-sm">Código: {orden?.codigo||"..."}</div>
          <div className="text-xs">Estado: {orden?.estado}</div>
        </div>
      </div></div>

      {/* COSTES (sin IVA) */}
      <div className="card"><div className="card-body grid gap-3">
        <div className="font-medium">Costes (sin IVA)</div>
        <div className="grid sm:grid-cols-4 gap-2">
          <label className="grid gap-1"><span className="text-sm">Horas</span><input className="input" type="number" value={horas} onChange={e=>setHoras(parseFloat(e.target.value)||0)}/></label>
        <label className="grid gap-1"><span className="text-sm">Tarifa {"\u20AC"}/h</span><input className="input" type="number" value={tarifa} onChange={e=>setTarifa(parseFloat(e.target.value)||0)}/></label>
          <label className="grid gap-1"><span className="text-sm">Mano de obra</span><input className="input" value={manoObra.toFixed(2)} readOnly/></label>
          <label className="grid gap-1"><span className="text-sm">Piezas</span><input className="input" value={piezasTotal.toFixed(2)} readOnly/></label>
        </div>
        <div className="text-xl font-bold">Total: {total.toFixed(2)} {"\u20AC"}</div>
      </div></div>

      {/* TIMELINE */}
      <div className="card"><div className="card-body grid gap-3">
        <div className="font-medium">Notas</div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <input className="input" placeholder="Nueva nota" value={nota} onChange={e=>setNota(e.target.value)}/>
          <button className="btn btn-primary" onClick={async()=>{ if(!nota.trim()) return; await db.eventos.add({ id:crypto.randomUUID(), ordenId, tipo:"nota", texto:nota.trim(), fecha:new Date().toISOString() }); setNota("") }}>Añadir</button>
        </div>
        {eventos?.length? (
          <ul className="text-sm">
            {eventos.map(e=>(<li key={e.id}>{new Date(e.fecha).toLocaleString()} — {e.texto}</li>))}
          </ul>
        ): <p className="text-sm opacity-60">Sin eventos.</p>}
      </div></div>

      {/* PIEZAS */}
      <div className="card"><div className="card-body grid gap-3">
        <div className="font-medium">Piezas</div>
        <div className="grid sm:grid-cols-4 gap-2">
          <input className="input" placeholder="Nombre" value={pieza.nombre} onChange={e=>setPieza({...pieza, nombre:e.target.value})}/>
          <input className="input" type="number" placeholder="Cant." value={pieza.cantidad} onChange={e=>setPieza({...pieza, cantidad:Math.max(1, parseInt(e.target.value||"1",10))})}/>
          <input className="input" type="number" placeholder="Coste" value={pieza.coste} onChange={e=>setPieza({...pieza, coste:parseFloat(e.target.value)||0})}/>
          <select className="input" value={pieza.estado} onChange={e=>setPieza({...pieza, estado:e.target.value as any})}>
            {["pendiente","pedido","recibido","instalado"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><button className="btn btn-primary" onClick={async()=>{ if(!pieza.nombre.trim()) return; await db.piezas.add({ id:crypto.randomUUID(), ordenId, nombre:pieza.nombre.trim(), cantidad:pieza.cantidad, coste:Number(pieza.coste)||0, estado:pieza.estado }); setPieza({ nombre:"", cantidad:1, coste:0, estado:"pendiente" }) }}>Añadir pieza</button></div>
        {piezas?.length? (
          <ul className="text-sm grid gap-1">
            {piezas.map(p=>(
              <li key={p.id} className="flex items-center gap-2">
                <span className="flex-1">{p.nombre} ×{p.cantidad} — {p.estado} — {p.coste.toFixed(2)} {"\u20AC"}</span>
                <button className="btn" onClick={async()=>{ await db.piezas.delete(p.id) }}>Borrar</button>
              </li>
            ))}
          </ul>
        ): <p className="text-sm opacity-60">Sin piezas.</p>}
      </div></div>

      {/* ADJUNTOS */}
      <div className="card"><div className="card-body grid gap-3">
        <div className="font-medium">Adjuntos</div>
        <input type="file" className="input" multiple onChange={async ev=>{ const fl=ev.target.files; if(!fl||!fl.length) return; for(const f of Array.from(fl)){ const id=crypto.randomUUID(); const arr=await f.arrayBuffer(); const blob=new Blob([arr],{type:f.type||"application/octet-stream"}); await db.adjuntos.add({ id, ordenId, nombre:f.name, tipo:f.type||"application/octet-stream", tam:f.size, fecha:new Date().toISOString(), blob }); } (ev.target as HTMLInputElement).value="" }}/>
        {files?.length? (
          <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map(f=>{
              const isImg=/^image\//.test(f.tipo); const url=URL.createObjectURL(f.blob)
              return (
                <div key={f.id} className="card"><div className="card-body grid gap-2">
                  <div className="text-sm break-all">{f.nombre}</div>
                  <div className="text-xs opacity-70">{fmtBytes(f.tam)} {"\u2022"} {new Date(f.fecha).toLocaleString()}</div>
                  {isImg? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={f.nombre} className="w-full h-32 object-cover rounded-lg border border-neutral-200/70 dark:border-neutral-800"/></a>
                        : <a href={url} target="_blank" rel="noreferrer" className="btn">Descargar</a>}
                  <div className="flex gap-2">
                    <a className="btn" href={url} download={f.nombre}>Guardar</a>
                    <button className="btn" onClick={async()=>{ await db.adjuntos.delete(f.id) }}>Borrar</button>
                  </div>
                </div></div>
              )
            })}
          </div>
        ): <p className="text-sm opacity-60">Sin adjuntos.</p>}
>>>>>>> Stashed changes
      </div></div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="card"><div className="card-body flex items-center gap-2">
            <span>{toast.msg}</span>
            {toast.action && <button className="btn btn-primary" onClick={()=>{ toast.action?.(); setToast(null) }}>Deshacer</button>}
            <button className="btn" onClick={()=>setToast(null)}>Cerrar</button>
          </div></div>
        </div>
      )}
    </section>
  )
}
