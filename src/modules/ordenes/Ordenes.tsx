import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { ChevronDown, ChevronRight, Download, Upload } from 'lucide-react'
import { forceSync } from '../../sync/autosync'

// -------------------- Tipos --------------------
type OrdenRow = {
  id: string
  codigo: string
  estado: string
  cliente: string
  telefono: string
  equipo: string
  creada: string
  actualizada: string
  // campos opcionales
  descripcion?: string
  tarifa?: number
  presupuestoAprox?: number | null
  precioNuevo?: number | null
  precioSegundaMano?: number | null
  horasReparacion?: number | null
}

type GrupoCliente = {
  clienteKey: string
  nombre: string
  telefono: string
  totalOrdenes: number
  ordenes: OrdenRow[]
}

// -------------------- Utilidades --------------------
function download(data: string, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function pickJSON(): Promise<any | null> {
  return new Promise(res => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = 'application/json'
    i.onchange = async () => {
      const f = i.files?.[0]
      if (!f) return res(null)
      try { const data = JSON.parse(await f.text()); res(data) } catch { res(null) }
    }
    i.click()
  })
}

// -------------------- Componente --------------------
export function Ordenes({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'todos' | 'recepcion' | 'diagnostico' | 'presupuesto' | 'reparacion' | 'listo' | 'entregado'>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [ordenar, setOrdenar] = useState<'creada_desc' | 'creada_asc' | 'act_desc' | 'act_asc'>('act_desc')
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Modal edición
  const [editing, setEditing] = useState<OrdenRow | null>(null)
  const [editData, setEditData] = useState<Partial<OrdenRow>>({})

  // 1. Cargar órdenes + enriquecer con cliente/equipo enlazados si faltan
  const allOrdenes = useLiveQuery(async () => {
    const ordenes = await db.ordenes.toArray()
    const clientes = await db.clientes.toArray()
    const equipos = await db.equipos.toArray()

    return ordenes.map((o: any) => {
      const c = clientes.find(x => x.id === o.clienteId)
      const e = equipos.find(x => x.id === o.equipoId)

      const nombreCliente = typeof o.cliente === 'object' ? o.cliente?.nombre : (o.cliente ?? c?.nombre ?? '—')
      const telefonoCliente = typeof o.cliente === 'object' ? o.cliente?.telefono : (o.telefono ?? c?.telefono ?? '—')
      const equipoTexto = typeof o.equipo === 'object'
	   ? `${o.equipo.marca ?? ''} ${o.equipo.modelo ?? ''} ${o.equipo.categoria ? `(${o.equipo.categoria})` : ''}`.trim()
       : (o.equipo ?? (`${e?.marca ?? ''} ${e?.modelo ?? ''}`.trim() || '—'))


      const row: OrdenRow = {
        id: o.id,
        codigo: o.codigo,
        estado: o.estado,
        cliente: nombreCliente,
        telefono: telefonoCliente,
        equipo: equipoTexto,
        creada: o.creada,
        actualizada: o.actualizada,
        descripcion: o.descripcion,
        tarifa: o.tarifa,
        presupuestoAprox: o.presupuestoAprox ?? null,
        precioNuevo: o.precioNuevo ?? null,
        precioSegundaMano: o.precioSegundaMano ?? null,
        horasReparacion: o.horasReparacion ?? null,
      }
      return row
    })
  }, [])

  // 2. Agrupar y filtrar
  const grupos = useMemo<GrupoCliente[]>(() => {
    if (!allOrdenes) return []

    const gruposMap: Record<string, GrupoCliente> = {}

    allOrdenes.forEach(o => {
      const key = `${o.cliente}-${o.telefono}`

      if (!gruposMap[key]) {
        gruposMap[key] = { clienteKey: key, nombre: o.cliente, telefono: o.telefono, totalOrdenes: 0, ordenes: [] }
      }
      gruposMap[key].ordenes.push(o)
      gruposMap[key].totalOrdenes++
    })

    const t = q.trim().toLowerCase()
    const sortFn = {
      creada_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.creada).getTime() - new Date(a.creada).getTime(),
      creada_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.creada).getTime() - new Date(b.creada).getTime(),
      act_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.actualizada).getTime() - new Date(a.actualizada).getTime(),
      act_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.actualizada).getTime() - new Date(b.actualizada).getTime(),
    }[ordenar]

    return Object.values(gruposMap)
      .map(g => {
        const ordenesFiltradas = g.ordenes.filter(r => {
          const matchesEstado = estado === 'todos' || r.estado === estado
          const matchesDesde = !desde || new Date(r.creada).getTime() >= new Date(desde).getTime()
          const matchesHasta = !hasta || new Date(r.creada).getTime() < new Date(hasta).getTime() + 86400000
          const matchesQuery = !t || r.cliente.toLowerCase().includes(t) || r.telefono.includes(t) || r.equipo.toLowerCase().includes(t) || r.codigo.toLowerCase().includes(t)
          return matchesEstado && matchesDesde && matchesHasta && matchesQuery
        }).sort(sortFn)
        return { ...g, ordenes: ordenesFiltradas, totalOrdenes: ordenesFiltradas.length }
      })
      .filter(g => g.totalOrdenes > 0)
  }, [allOrdenes, q, estado, desde, hasta, ordenar])

  // 3. Acciones básicas
  async function eliminarOrden(id: string) {
    if (!window.confirm('¿Eliminar esta orden definitivamente?')) return
    await db.ordenes.delete(id)
  }

  async function exportarDatos() {
    if (!allOrdenes) return
    const data = JSON.stringify(allOrdenes, null, 2)
    download(data, `ordenes_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json')
  }

  async function importarDatos() {
    if (!window.confirm('⚠️ Esto reemplazará todas las tablas locales. ¿Continuar?')) return
    const data = await pickJSON()
    if (!data || typeof data !== 'object') return alert('Archivo no válido.')

    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        const name = (table as any).name
        const registros = data[name]
        if (Array.isArray(registros)) {
          await (table as any).clear()
          await (table as any).bulkAdd(registros)
        }
      }
    })
    alert('✅ Importación completada. Recarga la página.')
    window.location.reload()
  }

  async function sincronizarManualmente() {
    setIsSyncing(true)
    await forceSync()
    setIsSyncing(false)
  }

  // ---- Edición ----
  function openEdit(row: OrdenRow) {
    setEditing(row)
    setEditData({ ...row })
  }

  function closeEdit() {
    setEditing(null)
    setEditData({})
  }

  async function saveEdit() {
    if (!editing) return
    if (!window.confirm('¿Guardar cambios en la orden?')) return

    // normalizar y guardar
    const patch: any = {
      codigo: editData.codigo ?? editing.codigo,
      estado: editData.estado ?? editing.estado,
      cliente: editData.cliente ?? editing.cliente,
      telefono: editData.telefono ?? editing.telefono,
      equipo: editData.equipo ?? editing.equipo,
      descripcion: editData.descripcion ?? editing.descripcion ?? '',
      tarifa: editData.tarifa ?? editing.tarifa ?? null,
      presupuestoAprox: (editData as any).presupuestoAprox ?? editing.presupuestoAprox ?? null,
      precioNuevo: (editData as any).precioNuevo ?? editing.precioNuevo ?? null,
      precioSegundaMano: (editData as any).precioSegundaMano ?? editing.precioSegundaMano ?? null,
      horasReparacion: (editData as any).horasReparacion ?? editing.horasReparacion ?? null,
      creada: editData.creada ?? editing.creada,
      actualizada: new Date().toISOString(),
    }

    try {
      await db.ordenes.update(editing.id, patch)
      closeEdit()
    } catch (e) {
      console.error(e)
      alert('No se pudo guardar.')
    }
  }

  const EditModal = editing ? (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-2xl">
        <div className="card-body grid gap-3">
          <div className="text-lg font-semibold">Editar orden</div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              <span className="text-xs opacity-70">Código</span>
              <input className="input w-full" value={editData.codigo ?? ''} onChange={e => setEditData(d => ({ ...d, codigo: e.target.value }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Estado</span>
              <select className="input w-full" value={(editData.estado as any) ?? 'recepcion'} onChange={e => setEditData(d => ({ ...d, estado: e.target.value }))}>
                <option value="recepcion">Recepción</option>
                <option value="diagnostico">Diagnóstico</option>
                <option value="presupuesto">Presupuesto</option>
                <option value="reparacion">Reparación</option>
                <option value="listo">Listo</option>
                <option value="entregado">Entregado</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs opacity-70">Cliente</span>
              <input className="input w-full" value={editData.cliente ?? ''} onChange={e => setEditData(d => ({ ...d, cliente: e.target.value }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Teléfono</span>
              <input className="input w-full" value={editData.telefono ?? ''} onChange={e => setEditData(d => ({ ...d, telefono: e.target.value }))} />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs opacity-70">Equipo</span>
              <input className="input w-full" value={editData.equipo ?? ''} onChange={e => setEditData(d => ({ ...d, equipo: e.target.value }))} placeholder="Aparato / Marca / Modelo / Serie" />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs opacity-70">Descripción</span>
              <textarea className="input w-full" rows={3} value={editData.descripcion ?? ''} onChange={e => setEditData(d => ({ ...d, descripcion: e.target.value }))} />
            </label>

            <label>
              <span className="text-xs opacity-70">Tarifa (€)</span>
              <input className="input w-full" type="number" step="0.01" value={editData.tarifa ?? ''} onChange={e => setEditData(d => ({ ...d, tarifa: e.target.value === '' ? null : Number(e.target.value) }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Presupuesto Aprox (€)</span>
              <input className="input w-full" type="number" step="0.01" value={editData.presupuestoAprox ?? ''} onChange={e => setEditData(d => ({ ...d, presupuestoAprox: e.target.value === '' ? null : Number(e.target.value) }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Precio Nuevo (€)</span>
              <input className="input w-full" type="number" step="0.01" value={editData.precioNuevo ?? ''} onChange={e => setEditData(d => ({ ...d, precioNuevo: e.target.value === '' ? null : Number(e.target.value) }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Precio 2ª Mano (€)</span>
              <input className="input w-full" type="number" step="0.01" value={editData.precioSegundaMano ?? ''} onChange={e => setEditData(d => ({ ...d, precioSegundaMano: e.target.value === '' ? null : Number(e.target.value) }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Horas reparación</span>
              <input className="input w-full" type="number" step="0.1" value={editData.horasReparacion ?? ''} onChange={e => setEditData(d => ({ ...d, horasReparacion: e.target.value === '' ? null : Number(e.target.value) }))} />
            </label>

            <label>
              <span className="text-xs opacity-70">Creada</span>
              <input className="input w-full" type="datetime-local"
                value={toLocalInput(editData.creada ?? editing?.creada)}
                onChange={e => setEditData(d => ({ ...d, creada: fromLocalInput(e.target.value) }))} />
            </label>
            <label>
              <span className="text-xs opacity-70">Actualizada</span>
              <input className="input w-full" type="datetime-local"
                value={toLocalInput(editData.actualizada ?? editing?.actualizada)}
                onChange={e => setEditData(d => ({ ...d, actualizada: fromLocalInput(e.target.value) }))} />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn" onClick={closeEdit}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveEdit}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        {/* Filtros y acciones */}
        <div className="grid sm:grid-cols-4 gap-3">
          <label className="sm:col-span-2">
            <span className="text-sm text-neutral-500">Buscar (Cliente, Teléfono, Equipo)</span>
            <input className="input w-full" value={q} onChange={e => setQ(e.target.value)} placeholder="Escribe para filtrar..." />
          </label>
          <label>
            <span className="text-sm text-neutral-500">Estado</span>
            <select className="input w-full" value={estado} onChange={e => setEstado(e.target.value as any)}>
              <option value="todos">Todos</option>
              <option value="recepcion">Recepción</option>
              <option value="diagnostico">Diagnóstico</option>
              <option value="presupuesto">Presupuesto</option>
              <option value="reparacion">Reparación</option>
              <option value="listo">Listo</option>
              <option value="entregado">Entregado</option>
            </select>
          </label>
          <label>
            <span className="text-sm text-neutral-500">Ordenar por</span>
            <select className="input w-full" value={ordenar} onChange={e => setOrdenar(e.target.value as any)}>
              <option value="act_desc">Actualizada ↓</option>
              <option value="act_asc">Actualizada ↑</option>
              <option value="creada_desc">Creada ↓</option>
              <option value="creada_asc">Creada ↑</option>
            </select>
          </label>
          <label>
            <span className="text-sm text-neutral-500">Desde</span>
            <input type="date" className="input w-full" value={desde} onChange={e => setDesde(e.target.value)} />
          </label>
          <label>
            <span className="text-sm text-neutral-500">Hasta</span>
            <input type="date" className="input w-full" value={hasta} onChange={e => setHasta(e.target.value)} />
          </label>
        </div>

        {/* Botones */}
        <div className="flex gap-2 justify-end pt-2">
          <button className="btn" onClick={exportarDatos}><Download className="size-4 mr-1" /> Exportar JSON</button>
          <button className="btn" onClick={importarDatos}><Upload className="size-4 mr-1" /> Importar JSON</button>
          <button className="btn btn-secondary" onClick={sincronizarManualmente} disabled={isSyncing}>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</button>
        </div>
      </div></div>

      {/* Tabla */}
      <div className="card overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              <th className="p-2 text-left w-10"></th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Teléfono</th>
              <th className="p-2 text-left">Órdenes</th>
              <th className="p-2 text-left">Última Act.</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(g => (
              <React.Fragment key={g.clienteKey}>
                <tr className="bg-neutral-50 dark:bg-neutral-700 font-semibold cursor-pointer border-y hover:bg-neutral-100 dark:hover:bg-neutral-600"
                    onClick={() => setExpandedCliente(expandedCliente === g.clienteKey ? null : g.clienteKey)}>
                  <td className="py-2 px-3">{expandedCliente === g.clienteKey ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                  <td className="py-2 pr-3">{g.nombre}</td>
                  <td className="py-2 pr-3">{g.telefono}</td>
                  <td className="py-2 pr-3">{g.totalOrdenes} órdenes</td>
                  <td className="py-2 pr-3">{new Date(g.ordenes[0].actualizada).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <button className="btn btn-sm btn-secondary mr-2" onClick={e => { e.stopPropagation(); onOpen(g.ordenes[0].id) }}>Abrir</button>
                    <button className="btn btn-sm" onClick={e => { e.stopPropagation(); openEdit(g.ordenes[0]) }}>Editar</button>
                  </td>
                </tr>

                {expandedCliente === g.clienteKey && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-500 border-b">
                            <th className="py-2 pl-8 text-left">Código</th>
                            <th className="py-2 text-left">Equipo</th>
                            <th className="py-2 text-left">Estado</th>
                            <th className="py-2 text-left">Creada</th>
                            <th className="py-2 text-left">Actualizada</th>
                            <th className="py-2 text-left w-28">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.ordenes.map(r => (
                            <tr key={r.id} className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-700">
                              <td className="py-2 pl-8">{r.codigo}</td>
                              <td className="py-2">{r.equipo}</td>
                              <td className="py-2">{r.estado}</td>
                              <td className="py-2">{new Date(r.creada).toLocaleString()}</td>
                              <td className="py-2">{new Date(r.actualizada).toLocaleString()}</td>
                              <td className="py-2 flex gap-2">
                                <button className="btn btn-primary" onClick={() => onOpen(r.id)}>Abrir</button>
                                <button className="btn" onClick={() => openEdit(r)}>Editar</button>
                                <button className="btn btn-danger" onClick={() => eliminarOrden(r.id)}>Eliminar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {grupos.length === 0 && (
              <tr><td className="py-4 opacity-70 px-4" colSpan={6}>No se encontraron órdenes que coincidan con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {EditModal}
    </section>
  )
}

// helpers fechas
function toLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return s
}
function fromLocalInput(local: string) {
  if (!local) return undefined
  const d = new Date(local)
  return d.toISOString()
}
