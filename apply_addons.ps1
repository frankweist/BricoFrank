# apply_addons.ps1 — Adjuntos en Reparación + Filtros en Órdenes + schema Dexie v2
$ErrorActionPreference='Stop'
Set-Location 'C:\gestor-reparaciones\apps\web'

# Asegura carpetas
@('src\data','src\domain','src\modules\reparacion','src\modules\ordenes') | ForEach-Object {
  New-Item -ItemType Directory -Force -Path $_ | Out-Null
}

# ---------- src\domain\types.ts (añade Adjunto) ----------
@'
export type EstadoOrden = 'recepcion'|'diagnostico'|'reparacion'|'listo'|'entregado'
export interface Cliente { id:string; nombre:string; telefono:string; email?:string; fecha_alta:string }
export interface Equipo { id:string; clienteId:string; categoria:string; marca:string; modelo:string; numeroSerie?:string; descripcion:string; fecha_recepcion:string }
export interface Orden { id:string; codigo:string; equipoId:string; estado:EstadoOrden; creada:string; actualizada:string }
export interface Evento { id:string; ordenId:string; tipo:'nota'|'prueba'|'cambio_estado'; texto:string; fecha:string }
export interface Pieza { id:string; ordenId:string; nombre:string; cantidad:number; coste:number; estado:'pendiente'|'pedido'|'recibido'|'instalado' }
export interface Adjunto { id:string; ordenId:string; nombre:string; tipo:string; tam:number; fecha:string; blob:Blob }
'@ | Set-Content src\domain\types.ts -Encoding utf8

# ---------- src\data\db.ts (versión 2 con adjuntos) ----------
@'
import Dexie, { Table } from 'dexie'
import type { Cliente, Equipo, Orden, Evento, Pieza, Adjunto } from '../domain/types'

export class GRDB extends Dexie {
  clientes!: Table<Cliente, string>
  equipos!: Table<Equipo, string>
  ordenes!: Table<Orden, string>
  eventos!: Table<Evento, string>
  piezas!: Table<Pieza, string>
  adjuntos!: Table<Adjunto, string>
  constructor(){
    super('gestor-reparaciones')
    this.version(1).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada',
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado'
    })
    this.version(2).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada',
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado',
      adjuntos:'id, ordenId, fecha'
    })
  }
}
export const db = new GRDB()
'@ | Set-Content src\data\db.ts -Encoding utf8

# ---------- src\modules\reparacion\DetalleOrden.tsx (adjuntos + mejoras) ----------
@'
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

function fmtBytes(n:number){
  if(n<1024) return n + " B"
  const k = 1024, u = ["KB","MB","GB","TB"]
  let i= -1, v=n
  do { v/=k; i++ } while(v>=k && i<u.length-1)
  return v.toFixed(1)+" "+u[i]
}

export function DetalleOrden({ ordenId }:{ ordenId:string }){
  const [nota, setNota] = useState('')
  const [pieza, setPieza] = useState({ nombre:'', cantidad:1, coste:0, estado:'pendiente' as 'pendiente'|'pedido'|'recibido'|'instalado' })
  const [horas, setHoras] = useState(1)
  const [tarifa, setTarifa] = useState(25)

  const orden   = useLiveQuery(()=> ordenId ? db.ordenes.get(ordenId) : undefined, [ordenId])
  const eventos = useLiveQuery(()=> ordenId ? db.eventos.where('ordenId').equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])
  const piezas  = useLiveQuery(()=> ordenId ? db.piezas.where('ordenId').equals(ordenId).toArray() : Promise.resolve([]), [ordenId])
  const files   = useLiveQuery(()=> ordenId ? db.adjuntos.where('ordenId').equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])

  const piezasTotal = useMemo(()=> (piezas||[]).reduce((s,p)=> s + (p.coste*p.cantidad), 0), [piezas])
  const manoObra = horas * tarifa
  const total = manoObra + piezasTotal // SIN IVA

  if(!ordenId) return <div className="card"><div className="card-body">Selecciona o crea una orden.</div></div>

  async function agregarEvento(){
    if(!nota.trim()) return
    await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo:'nota', texto: nota.trim(), fecha: new Date().toISOString() })
    setNota('')
  }
  async function agregarPieza(){
    if(!pieza.nombre.trim() || pieza.cantidad<=0) return
    await db.piezas.add({ id: crypto.randomUUID(), ordenId, nombre: pieza.nombre.trim(), cantidad: pieza.cantidad, coste: Number(pieza.coste)||0, estado: pieza.estado })
    setPieza({ nombre:'', cantidad:1, coste:0, estado:'pendiente' })
  }
  async function borrarPieza(id:string){ await db.piezas.delete(id) }
  async function cambiarEstado(nuevo:'recepcion'|'diagnostico'|'reparacion'|'listo'|'entregado'){
    await db.ordenes.update(ordenId, { estado:nuevo, actualizada:new Date().toISOString() })
    await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo:'cambio_estado', texto:`Estado: ${nuevo}`, fecha:new Date().toISOString() })
  }
  async function exportarJSON(){
    const payload = {
      clientes: await db.clientes.toArray(),
      equipos:  await db.equipos.toArray(),
      ordenes:  await db.ordenes.toArray(),
      eventos:  await db.eventos.toArray(),
      piezas:   await db.piezas.toArray(),
      adjuntos: await db.adjuntos.toArray()
    }
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'bricofrank-backup.json'; a.click()
    URL.revokeObjectURL(url)
  }

  async function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>){
    const fl = ev.target.files
    if(!fl || !fl.length) return
    for(const f of Array.from(fl)){
      const id = crypto.randomUUID()
      const arrBuf = await f.arrayBuffer()
      const blob = new Blob([arrBuf], { type: f.type || 'application/octet-stream' })
      await db.adjuntos.add({
        id, ordenId, nombre: f.name, tipo: f.type || 'application/octet-stream',
        tam: f.size, fecha: new Date().toISOString(), blob
      })
    }
    ev.target.value = ''
  }
  function asURL(b:Blob){ return URL.createObjectURL(b) }
  async function borrarAdjunto(id:string){ await db.adjuntos.delete(id) }

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Orden: {orden?.codigo || '...'}</h2>
          <span className="text-sm opacity-70">Estado actual: {orden?.estado}</span>
          <select className="input ml-auto max-w-48"
            value={orden?.estado || 'recepcion'}
            onChange={e=>cambiarEstado(e.target.value as any)}>
            {['recepcion','diagnostico','reparacion','listo','entregado'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={exportarJSON}>Exportar JSON</button>
        </div>

        {/* Resumen costos SIN IVA */}
        <div className="card"><div className="card-body grid gap-3">
          <div className="font-medium">Costes (sin IVA)</div>
          <div className="grid sm:grid-cols-4 gap-2">
            <label className="grid gap-1"><span className="text-sm">Horas</span>
              <input className="input" type="number" value={horas} onChange={e=>setHoras(parseFloat(e.target.value)||0)} />
            </label>
            <label className="grid gap-1"><span className="text-sm">Tarifa {"\u20AC"}/h</span>
              <input className="input" type="number" value={tarifa} onChange={e=>setTarifa(parseFloat(e.target.value)||0)} />
            </label>
            <label className="grid gap-1"><span className="text-sm">Mano de obra</span>
              <input className="input" value={manoObra.toFixed(2)} readOnly />
            </label>
            <label className="grid gap-1"><span className="text-sm">Piezas</span>
              <input className="input" value={piezasTotal.toFixed(2)} readOnly />
            </label>
          </div>
          <div className="text-xl font-bold">Total: {total.toFixed(2)} {"\u20AC"}</div>
        </div></div>

        {/* Eventos + Adjuntos */}
        <div className="grid lg:grid-cols-2 gap-3">
          {/* Eventos */}
          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Timeline</div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Nueva nota" value={nota} onChange={e=>setNota(e.target.value)} />
              <button className="btn btn-primary" onClick={agregarEvento}>A\u00F1adir</button>
            </div>
            {eventos?.length ? (
              <ul className="text-sm">
                {eventos.map(e=>(
                  <li key={e.id}>{new Date(e.fecha).toLocaleString()} — {e.texto}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin eventos.</p>}
          </div></div>

          {/* Piezas */}
          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Piezas</div>
            <div className="grid sm:grid-cols-4 gap-2">
              <input className="input" placeholder="Nombre" value={pieza.nombre} onChange={e=>setPieza({...pieza, nombre:e.target.value})}/>
              <input className="input" type="number" placeholder="Cant." value={pieza.cantidad} onChange={e=>setPieza({...pieza, cantidad: Math.max(1, parseInt(e.target.value||'1',10))})}/>
              <input className="input" type="number" placeholder="Coste" value={pieza.coste} onChange={e=>setPieza({...pieza, coste: parseFloat(e.target.value)||0})}/>
              <select className="input" value={pieza.estado} onChange={e=>setPieza({...pieza, estado: e.target.value as any})}>
                {['pendiente','pedido','recibido','instalado'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><button className="btn btn-primary" onClick={agregarPieza}>A\u00F1adir pieza</button></div>

            {piezas?.length ? (
              <ul className="text-sm grid gap-1">
                {piezas.map(p=>(
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="flex-1">{p.nombre} ×{p.cantidad} — {p.estado} — {p.coste.toFixed(2)} {"\u20AC"}</span>
                    <button className="btn" onClick={()=>borrarPieza(p.id)}>Borrar</button>
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
              {files.map(f=>{
                const isImg = /^image\\//.test(f.tipo)
                const url = asURL(f.blob)
                return (
                  <div key={f.id} className="card"><div className="card-body grid gap-2">
                    <div className="text-sm break-all">{f.nombre}</div>
                    <div className="text-xs opacity-70">{fmtBytes(f.tam)} • {new Date(f.fecha).toLocaleString()}</div>
                    {isImg ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={f.nombre} className="w-full h-32 object-cover rounded-lg border border-neutral-200/70 dark:border-neutral-800" />
                      </a>
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer" className="btn">Descargar</a>
                    )}
                    <div className="flex gap-2">
                      <a className="btn" href={url} download={f.nombre}>Guardar</a>
                      <button className="btn" onClick={()=>borrarAdjunto(f.id)}>Borrar</button>
                    </div>
                  </div></div>
                )
              })}
            </div>
          ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin adjuntos.</p>}
        </div></div>
      </div></div>
    </section>
  )
}
'@ | Set-Content src\modules\reparacion\DetalleOrden.tsx -Encoding utf8

# ---------- src\modules\ordenes\Ordenes.tsx (filtros) ----------
@'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

type OrdenRow = {
  id: string
  codigo: string
  estado: string
  cliente: string
  telefono: string
  equipo: string
  creada: string
  actualizada: string
}

export function Ordenes({ onOpen }:{ onOpen:(id:string)=>void }){
  const clientes = useLiveQuery(()=> db.clientes.toArray(), [])
  const equipos  = useLiveQuery(()=> db.equipos.toArray(),  [])
  const ordenes  = useLiveQuery(()=> db.ordenes.toArray(),  [])

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'todos'|'recepcion'|'diagnostico'|'reparacion'|'listo'|'entregado'>('todos')
  const [desde, setDesde] = useState('')  // yyyy-mm-dd
  const [hasta, setHasta] = useState('')
  const [ordenar, setOrdenar] = useState<'creada_desc'|'creada_asc'|'act_desc'|'act_asc'>('act_desc')

  const rows = useMemo<OrdenRow[]>(()=>{
    if(!clientes || !equipos || !ordenes) return []
    const byCliente = new Map(clientes.map(c=> [c.id, c]))
    const byEquipo  = new Map(equipos.map(e=> [e.id, e]))
    return ordenes.map(o=>{
      const eq = byEquipo.get(o.equipoId)
      const cl = eq ? byCliente.get(eq.clienteId) : undefined
      return {
        id: o.id,
        codigo: o.codigo,
        estado: o.estado,
        cliente: cl?.nombre || '',
        telefono: cl?.telefono || '',
        equipo: eq ? `${eq.categoria} ${eq.marca} ${eq.modelo}` : '',
        creada: o.creada,
        actualizada: o.actualizada
      }
    })
  }, [clientes,equipos,ordenes])

  const filtered = useMemo(()=>{
    const t = q.trim().toLowerCase()
    let list = rows
    if(t){
      list = list.filter(r =>
        r.codigo.toLowerCase().includes(t) ||
        r.cliente.toLowerCase().includes(t) ||
        r.telefono.toLowerCase().includes(t) ||
        r.equipo.toLowerCase().includes(t) ||
        r.estado.toLowerCase().includes(t)
      )
    }
    if(estado!=='todos'){ list = list.filter(r=> r.estado===estado) }
    if(desde){ const d = new Date(desde); list = list.filter(r=> new Date(r.creada) >= d) }
    if(hasta){ const h = new Date(hasta); h.setHours(23,59,59,999); list = list.filter(r=> new Date(r.creada) <= h) }
    const by = {
      creada_desc:(a:OrdenRow,b:OrdenRow)=> new Date(b.creada).getTime()-new Date(a.creada).getTime(),
      creada_asc:(a:OrdenRow,b:OrdenRow)=> new Date(a.creada).getTime()-new Date(b.creada).getTime(),
      act_desc:(a:OrdenRow,b:OrdenRow)=> new Date(b.actualizada).getTime()-new Date(a.actualizada).getTime(),
      act_asc:(a:OrdenRow,b:OrdenRow)=> new Date(a.actualizada).getTime()-new Date(b.actualizada).getTime(),
    }[ordenar]
    return [...list].sort(by)
  }, [rows,q,estado,desde,hasta,ordenar])

  return (
    <section className="grid gap-3">
      <div className="card"><div className="card-body">
        <div className="grid lg:grid-cols-5 gap-2">
          <input className="input" placeholder="Buscar por c\u00F3digo, cliente, tel\u00E9fono o equipo" value={q} onChange={e=>setQ(e.target.value)} />
          <select className="input" value={estado} onChange={e=>setEstado(e.target.value as any)}>
            <option value="todos">Todos</option>
            <option value="recepcion">recepcion</option>
            <option value="diagnostico">diagnostico</option>
            <option value="reparacion">reparacion</option>
            <option value="listo">listo</option>
            <option value="entregado">entregado</option>
          </select>
          <input className="input" type="date" value={desde} onChange={e=>setDesde(e.target.value)} />
          <input className="input" type="date" value={hasta} onChange={e=>setHasta(e.target.value)} />
          <select className="input" value={ordenar} onChange={e=>setOrdenar(e.target.value as any)}>
            <option value="act_desc">Act. reciente</option>
            <option value="act_asc">Act. antigua</option>
            <option value="creada_desc">Creada reciente</option>
            <option value="creada_asc">Creada antigua</option>
          </select>
        </div>
      </div></div>

      <div className="card"><div className="card-body">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-3">C\u00F3digo</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Tel\u00E9fono</th>
                <th className="py-2 pr-3">Equipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Creada</th>
                <th className="py-2 pr-3">Actualizada</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} className="border-t border-neutral-200/70 dark:border-neutral-800">
                  <td className="py-2 pr-3">{r.codigo}</td>
                  <td className="py-2 pr-3">{r.cliente}</td>
                  <td className="py-2 pr-3">{r.telefono}</td>
                  <td className="py-2 pr-3">{r.equipo}</td>
                  <td className="py-2 pr-3">{r.estado}</td>
                  <td className="py-2 pr-3">{new Date(r.creada).toLocaleString()}</td>
                  <td className="py-2 pr-3">{new Date(r.actualizada).toLocaleString()}</td>
                  <td className="py-2"><button className="btn btn-primary" onClick={()=>onOpen(r.id)}>Abrir</button></td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td className="py-4 opacity-70" colSpan={8}>Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div></div>
    </section>
  )
}
'@ | Set-Content src\modules\ordenes\Ordenes.tsx -Encoding utf8

# Limpia caché y arranca
Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev
