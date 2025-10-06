# bootstrap.ps1 — crea/actualiza estructura v0.2 con Dexie (PowerShell 5+)
$ErrorActionPreference = 'Stop'

# Carpetas
$dirs = @(
  "src","src\modules\app","src\modules\registro","src\modules\presupuesto",
  "src\modules\reparacion","src\domain","src\data"
)
$dirs | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }

# -------- src/domain/types.ts --------
@'
export type EstadoOrden = 'recepcion'|'diagnostico'|'reparacion'|'listo'|'entregado'
export interface Cliente { id:string; nombre:string; telefono:string; email?:string; fecha_alta:string }
export interface Equipo { id:string; clienteId:string; categoria:string; marca:string; modelo:string; numeroSerie?:string; descripcion:string; fecha_recepcion:string }
export interface Orden { id:string; codigo:string; equipoId:string; estado:EstadoOrden; creada:string; actualizada:string }
export interface Evento { id:string; ordenId:string; tipo:'nota'|'prueba'|'cambio_estado'; texto:string; fecha:string }
export interface Pieza { id:string; ordenId:string; nombre:string; cantidad:number; coste:number; estado:'pendiente'|'pedido'|'recibido'|'instalado' }
'@ | Set-Content src\domain\types.ts -Encoding UTF8

# -------- src/data/db.ts --------
@'
import Dexie, { Table } from 'dexie'
import type { Cliente, Equipo, Orden, Evento, Pieza } from '../domain/types'

export class GRDB extends Dexie {
  clientes!: Table<Cliente, string>
  equipos!: Table<Equipo, string>
  ordenes!: Table<Orden, string>
  eventos!: Table<Evento, string>
  piezas!: Table<Pieza, string>
  constructor(){
    super('gestor-reparaciones')
    this.version(1).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada',
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado'
    })
  }
}
export const db = new GRDB()
'@ | Set-Content src\data\db.ts -Encoding UTF8

# -------- src/domain/services.ts --------
@'
import { v4 as uuid } from 'uuid'
import { db } from '../data/db'
import type { Cliente, Equipo, Orden, Evento } from './types'

export function genCodigoOrden(now=Date.now()){ return 'ORD-'+now }

export async function crearOrdenCompleta(input:{
  cliente: Pick<Cliente,'nombre'|'telefono'|'email'>,
  equipo: Pick<Equipo,'categoria'|'marca'|'modelo'|'numeroSerie'|'descripcion'>
}){
  const ahora = new Date().toISOString()
  const cliente: Cliente = { id: uuid(), nombre: input.cliente.nombre, telefono: input.cliente.telefono, email: input.cliente.email, fecha_alta: ahora }
  const equipo: Equipo = { id: uuid(), clienteId: cliente.id, categoria: input.equipo.categoria, marca: input.equipo.marca, modelo: input.equipo.modelo, numeroSerie: input.equipo.numeroSerie, descripcion: input.equipo.descripcion, fecha_recepcion: ahora }
  const orden: Orden = { id: uuid(), codigo: genCodigoOrden(), equipoId: equipo.id, estado: 'recepcion', creada: ahora, actualizada: ahora }
  const evento: Evento = { id: uuid(), ordenId: orden.id, tipo: 'nota', texto: 'Orden creada', fecha: ahora }
  await db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, async ()=>{
    await db.clientes.add(cliente)
    await db.equipos.add(equipo)
    await db.ordenes.add(orden)
    await db.eventos.add(evento)
  })
  return { cliente, equipo, orden }
}
'@ | Set-Content src\domain\services.ts -Encoding UTF8

# -------- src/modules/app/Layout.tsx --------
@'
import { useEffect, useState } from 'react'
import { Wrench, Moon, Sun, ClipboardList, Calculator, Hammer } from 'lucide-react'
import type { Tab } from '../../App'

export function Layout({ tab, onTab, children }:{ tab:Tab; onTab:(t:Tab)=>void; children:React.ReactNode }){
  const [dark, setDark] = useState(()=> localStorage.getItem('gr_dark')==='1')
  useEffect(()=>{
    const r=document.documentElement
    if(dark){ r.classList.add('dark'); localStorage.setItem('gr_dark','1') }
    else { r.classList.remove('dark'); localStorage.setItem('gr_dark','0') }
  },[dark])

  return (
    <div className='min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr] bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'>
      <aside className='hidden lg:flex lg:flex-col gap-2 border-r border-neutral-200/70 dark:border-neutral-800 p-4'>
        <div className='flex items-center gap-2 font-semibold text-lg'><Wrench className='size-5'/> Gestor</div>
        <nav className='mt-4 grid gap-1'>
          <NavItem icon={ClipboardList} label='Registro' active={tab==='registro'} onClick={()=>onTab('registro')}/>
          <NavItem icon={Calculator} label='Presupuesto' active={tab==='presupuesto'} onClick={()=>onTab('presupuesto')}/>
          <NavItem icon={Hammer} label='Reparación' active={tab==='reparacion'} onClick={()=>onTab('reparacion')}/>
        </nav>
        <div className='mt-auto pt-4 border-t border-neutral-200/70 dark:border-neutral-800'>
          <button className='btn btn-ghost w-full' onClick={()=>setDark(v=>!v)}>
            {dark ? <Sun className='size-4'/> : <Moon className='size-4'/>}<span className='ml-2'>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>
        </div>
      </aside>
      <div className='flex flex-col min-h-screen'>
        <header className='sticky top-0 z-10 border-b border-neutral-200/70 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/70 backdrop-blur'>
          <div className='max-w-6xl mx-auto px-4 py-3 flex items-center gap-3'>
            <Wrench className='size-5 lg:hidden'/><h1 className='font-semibold'>Gestor de Reparaciones</h1>
            <div className='ml-auto flex items-center gap-2'>
              <button className={`tab ${tab==='registro'?'tab-active':''}`} onClick={()=>onTab('registro')}>Registro</button>
              <button className={`tab ${tab==='presupuesto'?'tab-active':''}`} onClick={()=>onTab('presupuesto')}>Presupuesto</button>
              <button className={`tab ${tab==='reparacion'?'tab-active':''}`} onClick={()=>onTab('reparacion')}>Reparación</button>
            </div>
          </div>
        </header>
        <main className='max-w-6xl w-full mx-auto p-4'><div className='grid gap-4'>{children}</div></main>
      </div>
    </div>
  )
}
function NavItem({icon:Icon,label,active,onClick}:{icon:any;label:string;active?:boolean;onClick:()=>void}){
  return (<button onClick={onClick} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900 ${active?'bg-neutral-100 dark:bg-neutral-900 font-medium':''}`}><Icon className='size-4'/> <span>{label}</span></button>)
}
'@ | Set-Content src\modules\app\Layout.tsx -Encoding UTF8

# -------- src/modules/registro/Registro.tsx --------
@'
import { useState } from 'react'
import { crearOrdenCompleta } from '../../domain/services'

export function Registro({ onCreated }:{ onCreated:(ordenId:string)=>void }){
  const [f, setF] = useState({ nombre:'', telefono:'', email:'', categoria:'Otros', marca:'', modelo:'', numeroSerie:'', descripcion:'' })
  const can = f.nombre && f.telefono && f.marca && f.modelo && f.descripcion
  return (
    <section className='grid gap-4'>
      <div className='card'><div className='card-body'>
        <h2 className='text-lg font-semibold mb-2'>Registro cliente y aparato</h2>
        <div className='grid sm:grid-cols-2 gap-3'>
          <Field label='Nombre*'><input className='input' value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})}/></Field>
          <Field label='Teléfono*'><input className='input' value={f.telefono} onChange={e=>setF({...f,telefono:e.target.value})}/></Field>
          <Field label='Email'><input className='input' value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></Field>
          <Field label='Categoría'><select className='input' value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value})}>{['Móviles','Ordenadores','Consolas','Televisores','Placas','Robots','Otros'].map(x=> <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label='Marca*'><input className='input' value={f.marca} onChange={e=>setF({...f,marca:e.target.value})}/></Field>
          <Field label='Modelo*'><input className='input' value={f.modelo} onChange={e=>setF({...f,modelo:e.target.value})}/></Field>
          <Field label='Nº de serie'><input className='input' value={f.numeroSerie} onChange={e=>setF({...f,numeroSerie:e.target.value})}/></Field>
        </div>
        <Field label='Daño inicial*'><textarea className='input min-h-28' value={f.descripcion} onChange={e=>setF({...f,descripcion:e.target.value})}/></Field>
        <div className='flex gap-2'>
          <button className='btn btn-primary' disabled={!can} onClick={async()=>{
            const { orden } = await crearOrdenCompleta({
              cliente:{ nombre:f.nombre, telefono:f.telefono, email:f.email },
              equipo:{ categoria:f.categoria, marca:f.marca, modelo:f.modelo, numeroSerie:f.numeroSerie, descripcion:f.descripcion }
            })
            onCreated(orden.id)
          }}>Crear orden</button>
          <button className='btn' onClick={()=>setF({ nombre:'', telefono:'', email:'', categoria:'Otros', marca:'', modelo:'', numeroSerie:'', descripcion:'' })}>Limpiar</button>
        </div>
      </div></div>
    </section>
  )
}
function Field({label, children}:{label:string; children:React.ReactNode}){ return (<label className='grid gap-1'><span className='text-sm text-neutral-500 dark:text-neutral-400'>{label}</span>{children}</label>) }
'@ | Set-Content src\modules\registro\Registro.tsx -Encoding UTF8

# -------- src/modules/reparacion/DetalleOrden.tsx --------
@'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

export function DetalleOrden({ ordenId }:{ ordenId:string }){
  const orden = useLiveQuery(()=> ordenId ? db.ordenes.get(ordenId) : undefined, [ordenId])
  const eventos = useLiveQuery(()=> ordenId ? db.eventos.where('ordenId').equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])
  const piezas = useLiveQuery(()=> ordenId ? db.piezas.where('ordenId').equals(ordenId).toArray() : Promise.resolve([]), [ordenId])
  if(!ordenId) return <div className='card'><div className='card-body'>Selecciona o crea una orden.</div></div>
  return (
    <section className='grid gap-4'>
      <div className='card'><div className='card-body'>
        <h2 className='text-lg font-semibold mb-2'>Orden: {orden?.codigo || '...'}</h2>
        <div className='grid md:grid-cols-2 gap-3'>
          <div className='card'><div className='card-body'>
            <div className='font-medium mb-1'>Timeline</div>
            {eventos?.length? <ul className='text-sm'>{eventos.map(e=> <li key={e.id}>{new Date(e.fecha).toLocaleString()} — {e.texto}</li>)}</ul> : <p className='text-sm text-neutral-500 dark:text-neutral-400'>Sin eventos.</p>}
          </div></div>
          <div className='card'><div className='card-body'>
            <div className='font-medium mb-1'>Piezas</div>
            {piezas?.length? <ul className='text-sm'>{piezas.map(p=> <li key={p.id}>{p.nombre} ×{p.cantidad} — {p.estado} — {p.coste.toFixed(2)}€</li>)}</ul> : <p className='text-sm text-neutral-500 dark:text-neutral-400'>Sin piezas.</p>}
          </div></div>
        </div>
      </div></div>
    </section>
  )
}
'@ | Set-Content src\modules\reparacion\DetalleOrden.tsx -Encoding UTF8

# -------- src/modules/presupuesto/Presupuesto.tsx --------
@'
import { useState } from 'react'
export function Presupuesto(){
  const [horas, setHoras] = useState(1); const [tarifa, setTarifa] = useState(25); const [piezas, setPiezas] = useState(0); const iva=21
  const manoObra=horas*tarifa, subtotal=manoObra+piezas, ivaImporte=subtotal*iva/100, total=subtotal+ivaImporte
  return (
    <section className='grid gap-4'>
      <div className='card'><div className='card-body grid gap-4'>
        <h2 className='text-lg font-semibold'>Presupuesto inicial</h2>
        <div className='grid sm:grid-cols-3 gap-3'>
          <Field label='Horas'><input type='number' className='input' value={horas} onChange={e=>setHoras(parseFloat(e.target.value)||0)}/></Field>
          <Field label='Tarifa €/h'><input type='number' className='input' value={tarifa} onChange={e=>setTarifa(parseFloat(e.target.value)||0)}/></Field>
          <Field label='Piezas €'><input type='number' className='input' value={piezas} onChange={e=>setPiezas(parseFloat(e.target.value)||0)}/></Field>
        </div>
        <div className='grid sm:grid-cols-2 md:grid-cols-4 gap-3'>
          <KPI label='Mano de obra' value={manoObra}/>
          <KPI label='Subtotal' value={subtotal}/>
          <KPI label='IVA' value={ivaImporte}/>
          <KPI label='Total' value={total} strong/>
        </div>
      </div></div>
    </section>
  )
}
function KPI({label, value, strong}:{label:string; value:number; strong?:boolean}){ return (<div className='card'><div className='card-body'><div className='text-sm text-neutral-500 dark:text-neutral-400'>{label}</div><div className={`text-xl ${strong?'font-bold':''}`}>{value.toFixed(2)}</div></div></div>) }
function Field({label, children}:{label:string; children:React.ReactNode}){ return (<label className='grid gap-1'><span className='text-sm text-neutral-500 dark:text-neutral-400'>{label}</span>{children}</label>) }
'@ | Set-Content src\modules\presupuesto\Presupuesto.tsx -Encoding UTF8

# -------- src/App.tsx --------
@'
import { useState } from 'react'
import { Layout } from './modules/app/Layout'
import { Registro } from './modules/registro/Registro'
import { Presupuesto } from './modules/presupuesto/Presupuesto'
import { DetalleOrden } from './modules/reparacion/DetalleOrden'
export type Tab = 'registro'|'presupuesto'|'reparacion'
export default function App(){
  const [tab, setTab] = useState<Tab>('registro')
  return (
    <Layout tab={tab} onTab={setTab}>
      {tab==='registro' && <Registro onCreated={(id)=>{ setTab('reparacion'); sessionStorage.setItem('ordenActual', id) }} />}
      {tab==='presupuesto' && <Presupuesto/>}
      {tab==='reparacion' && <DetalleOrden ordenId={sessionStorage.getItem('ordenActual')||''}/>}
    </Layout>
  )
}
'@ | Set-Content src\App.tsx -Encoding UTF8

# -------- src/styles.css (Tailwind v4) --------
@'
@import "tailwindcss";
.btn{ @apply inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-200/70 dark:border-neutral-800 active:scale-[.99]; }
.btn-primary{ @apply bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200; }
.btn-ghost{ @apply hover:bg-neutral-100 dark:hover:bg-neutral-900; }
.card{ @apply bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 rounded-2xl shadow; }
.card-body{ @apply p-4 sm:p-6; }
.input{ @apply w-full rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-400/40; }
.tab{ @apply px-3 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900; }
.tab-active{ @apply bg-neutral-100 dark:bg-neutral-900 font-medium; }
'@ | Set-Content src\styles.css -Encoding UTF8

Write-Host "OK: estructura v0.2 escrita."
