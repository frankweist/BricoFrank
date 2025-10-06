# apply_edit_registro.ps1 — Edición de datos de Cliente y Equipo en DetalleOrden
$ErrorActionPreference='Stop'
Set-Location 'C:\gestor-reparaciones\apps\web'

@'
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

function fmtBytes(n: number) {
  if (n < 1024) return n + ' B'
  const k = 1024, u = ['KB', 'MB', 'GB', 'TB']
  let i = -1, v = n
  do { v /= k; i++ } while (v >= k && i < u.length - 1)
  return v.toFixed(1) + ' ' + u[i]
}

export function DetalleOrden({ ordenId }: { ordenId: string }) {
  const [nota, setNota] = useState('')
  const [pieza, setPieza] = useState({
    nombre: '', cantidad: 1, coste: 0,
    estado: 'pendiente' as 'pendiente' | 'pedido' | 'recibido' | 'instalado'
  })
  const [horas, setHoras] = useState(1)
  const [tarifa, setTarifa] = useState(25)
  const [edit, setEdit] = useState(false)

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

  const eventos = useLiveQuery(() => ordenId ? db.eventos.where('ordenId').equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])
  const piezas  = useLiveQuery(() => ordenId ? db.piezas.where('ordenId').equals(ordenId).toArray() : Promise.resolve([]), [ordenId])
  const files   = useLiveQuery(() => ordenId ? db.adjuntos.where('ordenId').equals(ordenId).reverse().toArray() : Promise.resolve([]), [ordenId])

  const piezasTotal = useMemo(() => (piezas || []).reduce((s, p) => s + (p.coste * p.cantidad), 0), [piezas])
  const manoObra = horas * tarifa
  const total = manoObra + piezasTotal // SIN IVA

  // Estado local para edición
  const [cForm, setCForm] = useState({ nombre:'', telefono:'', email:'' })
  const [eForm, setEForm] = useState({ categoria:'Otros', marca:'', modelo:'', numeroSerie:'', descripcion:'' })

  // Sin orden seleccionada
  if (!ordenId) return <div className="card"><div className="card-body">Selecciona o crea una orden.</div></div>

  // Inicializa formularios cuando entramos en modo edición
  function startEdit(){
    if(!cliente || !equipo) return
    setCForm({ nombre: cliente.nombre||'', telefono: cliente.telefono||'', email: cliente.email||'' })
    setEForm({
      categoria: equipo.categoria||'Otros',
      marca: equipo.marca||'',
      modelo: equipo.modelo||'',
      numeroSerie: equipo.numeroSerie||'',
      descripcion: equipo.descripcion||'',
    })
    setEdit(true)
  }

  async function saveEdit(){
    if(!orden || !cliente || !equipo) return
    if(!cForm.nombre.trim() || !cForm.telefono.trim() || !eForm.marca.trim() || !eForm.modelo.trim() || !eForm.descripcion.trim()) return
    await db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, async ()=>{
      await db.clientes.update(cliente.id, {
        nombre: cForm.nombre.trim(),
        telefono: cForm.telefono.trim(),
        email: cForm.email.trim() || undefined
      })
      await db.equipos.update(equipo.id, {
        categoria: eForm.categoria,
        marca: eForm.marca.trim(),
        modelo: eForm.modelo.trim(),
        numeroSerie: eForm.numeroSerie.trim() || undefined,
        descripcion: eForm.descripcion.trim()
      })
      await db.ordenes.update(orden.id, { actualizada: new Date().toISOString() })
      await db.eventos.add({
        id: crypto.randomUUID(),
        ordenId: orden.id,
        tipo: 'nota',
        texto: 'Datos de cliente/equipo actualizados',
        fecha: new Date().toISOString()
      })
    })
    setEdit(false)
  }

  async function agregarEvento() {
    if (!nota.trim()) return
    await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo: 'nota', texto: nota.trim(), fecha: new Date().toISOString() })
    setNota('')
  }
  async function agregarPieza() {
    if (!pieza.nombre.trim() || pieza.cantidad <= 0) return
    await db.piezas.add({ id: crypto.randomUUID(), ordenId, nombre: pieza.nombre.trim(), cantidad: pieza.cantidad, coste: Number(pieza.coste) || 0, estado: pieza.estado })
    setPieza({ nombre: '', cantidad: 1, coste: 0, estado: 'pendiente' })
  }
  async function borrarPieza(id: string) { await db.piezas.delete(id) }
  async function cambiarEstado(nuevo: 'recepcion' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado') {
    await db.ordenes.update(ordenId, { estado: nuevo, actualizada: new Date().toISOString() })
    await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo: 'cambio_estado', texto: `Estado: ${nuevo}`, fecha: new Date().toISOString() })
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
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'bricofrank-backup.json'; a.click()
    URL.revokeObjectURL(url)
  }

  async function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const fl = ev.target.files
    if (!fl || !fl.length) return
    for (const f of Array.from(fl)) {
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
  function asURL(b: Blob) { return URL.createObjectURL(b) }
  async function borrarAdjunto(id: string) { await db.adjuntos.delete(id) }

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Orden: {orden?.codigo || '...'}</h2>
          <span className="text-sm opacity-70">Estado actual: {orden?.estado}</span>
          <select className="input ml-auto max-w-48"
            value={orden?.estado || 'recepcion'}
            onChange={e => cambiarEstado(e.target.value as any)}>
            {['recepcion', 'diagnostico', 'reparacion', 'listo', 'entregado'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={exportarJSON}>Exportar JSON</button>
          {!edit && <button className="btn btn-primary" onClick={startEdit}>Editar datos</button>}
        </div>

        {/* Bloque de EDICION */}
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
                  {['M\u00F3viles','Ordenadores','Consolas','Televisores','Placas','Robots','Bater\u00EDas','Otros'].map(x=> <option key={x} value={x}>{x}</option>)}
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
            <label className="grid gap-1"><span className="text-sm">Tarifa {'\u20AC'}/h</span>
              <input className="input" type="number" value={tarifa} onChange={e => setTarifa(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="grid gap-1"><span className="text-sm">Mano de obra</span>
              <input className="input" value={manoObra.toFixed(2)} readOnly />
            </label>
            <label className="grid gap-1"><span className="text-sm">Piezas</span>
              <input className="input" value={piezasTotal.toFixed(2)} readOnly />
            </label>
          </div>
          <div className="text-xl font-bold">Total: {total.toFixed(2)} {'\u20AC'}</div>
        </div></div>

        {/* Eventos y Piezas */}
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Timeline</div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Nueva nota" value={nota} onChange={e => setNota(e.target.value)} />
              <button className="btn btn-primary" onClick={agregarEvento}>A{"\u00F1"}adir</button>
            </div>
            {eventos?.length ? (
              <ul className="text-sm">
                {eventos.map(e => (
                  <li key={e.id}>{new Date(e.fecha).toLocaleString()} {"\u2014"} {e.texto}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin eventos.</p>}
          </div></div>

          <div className="card"><div className="card-body grid gap-3">
            <div className="font-medium">Piezas</div>
            <div className="grid sm:grid-cols-4 gap-2">
              <input className="input" placeholder="Nombre" value={pieza.nombre} onChange={e => setPieza({ ...pieza, nombre: e.target.value })} />
              <input className="input" type="number" placeholder="Cant." value={pieza.cantidad} onChange={e => setPieza({ ...pieza, cantidad: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
              <input className="input" type="number" placeholder="Coste" value={pieza.coste} onChange={e => setPieza({ ...pieza, coste: parseFloat(e.target.value) || 0 })} />
              <select className="input" value={pieza.estado} onChange={e => setPieza({ ...pieza, estado: e.target.value as any })}>
                {['pendiente', 'pedido', 'recibido', 'instalado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><button className="btn btn-primary" onClick={agregarPieza}>A{"\u00F1"}adir pieza</button></div>

            {piezas?.length ? (
              <ul className="text-sm grid gap-1">
                {piezas.map(p => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="flex-1">{p.nombre} {"\u00D7"}{p.cantidad} {"\u2014"} {p.estado} {"\u2014"} {p.coste.toFixed(2)} {"\u20AC"}</span>
                    <button className="btn" onClick={() => borrarPieza(p.id)}>Borrar</button>
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
                const url = asURL(f.blob)
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
      </div></div>
    </section>
  )
}
'@ | Set-Content src\modules\reparacion\DetalleOrden.tsx -Encoding utf8

Remove-Item -Recurse -Force .\node_modules\.vite -ErrorAction SilentlyContinue
npm run dev
