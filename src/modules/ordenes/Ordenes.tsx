import { useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "../../data/db"
import { deleteOrdenCascade } from "../../domain/cascade"
import { pushAllSupabase, pullLatestSupabase } from "../../sync/supabaseSync"

// Tipado principal de las filas de tabla
type OrdenRow = {
  id: string
  codigo: string
  estado: string
  clienteId: string
  cliente: string
  telefono: string
  equipo: string
  creada: string
  actualizada: string
}

// Convierte array de OrdenRow a CSV
function toCSV(rows: OrdenRow[]) {
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const head = ["ID", "Codigo", "Estado", "Cliente", "Telefono", "Equipo", "Creada", "Actualizada"]
  const lines = [head.join(",")].concat(
    rows.map(r => [
      r.id, r.codigo, r.estado, r.cliente, r.telefono, r.equipo,
      // Para formato portátil, usa toISOString
      new Date(r.creada).toISOString(), new Date(r.actualizada).toISOString()
    ].map(esc).join(","))
  )
  return lines.join("\r\n")
}

// Selector simple de archivo JSON
async function pickJSON(): Promise<any | null> {
  return new Promise(res => {
    const i = document.createElement("input")
    i.type = "file"; i.accept = "application/json"
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) { res(null); return }
      try { const data = JSON.parse(await f.text()); res(data) }
      catch { 
        alert("El archivo seleccionado no es un JSON válido.")
        res(null) 
      }
    }
    i.click()
  })
}

export function Ordenes({ onOpen }: { onOpen: (id: string) => void }) {
  // LiveQuery sobre las tablas principales
  const clientes = useLiveQuery(() => db.clientes.toArray(), [])
  const equipos   = useLiveQuery(() => db.equipos.toArray(), [])
  const ordenes   = useLiveQuery(() => db.ordenes.toArray(), [])

  // Estados de filtros y UI
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState<"todos"|"recepcion"|"diagnostico"|"reparacion"|"listo"|"entregado">("todos")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [ordenar, setOrdenar] = useState<"creada_desc"|"creada_asc"|"act_desc"|"act_asc">("act_desc")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Genera las filas con join cliente/equipo
  const rows = useMemo<OrdenRow[]>(() => {
    if (!clientes || !equipos || !ordenes) return []
    const byCliente = new Map(clientes.map(c => [c.id, c]))
    const byEquipo  = new Map(equipos.map(e => [e.id, e]))
    return ordenes.map(o => {
      const eq = byEquipo.get(o.equipoId)
      const cl = eq ? byCliente.get(eq.clienteId) : undefined
      return {
        id: o.id,
        codigo: o.codigo,
        estado: o.estado,
        clienteId: cl?.id || "",
        cliente: cl?.nombre || "",
        telefono: cl?.telefono || "",
        equipo: eq ? `${eq.categoria} ${eq.marca} ${eq.modelo}` : "",
        creada: o.creada,
        actualizada: o.actualizada
      }
    })
  }, [clientes, equipos, ordenes])

  // Filtrado y ordenado
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    let list = rows
    if (t) {
      list = list.filter(r =>
        r.codigo.toLowerCase().includes(t) ||
        r.cliente.toLowerCase().includes(t) ||
        r.telefono.toLowerCase().includes(t) ||
        r.equipo.toLowerCase().includes(t) ||
        r.estado.toLowerCase().includes(t)
      )
    }
    if (estado !== "todos") { list = list.filter(r => r.estado === estado) }
    if (desde) { const d = new Date(desde); list = list.filter(r => new Date(r.creada) >= d) }
    if (hasta) { const h = new Date(hasta); h.setHours(23, 59, 59, 999); list = list.filter(r => new Date(r.creada) <= h) }
    const by = {
      creada_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.creada).getTime() - new Date(a.creada).getTime(),
      creada_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.creada).getTime() - new Date(b.creada).getTime(),
      act_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.actualizada).getTime() - new Date(a.actualizada).getTime(),
      act_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.actualizada).getTime() - new Date(b.actualizada).getTime(),
    }[ordenar]
    return [...list].sort(by)
  }, [rows, q, estado, desde, hasta, ordenar])

  // Agrupado por clienteId
  const groups = useMemo(() => {
    const m = new Map<string, OrdenRow[]>()
    for (const r of filtered) {
      if (!m.has(r.clienteId)) m.set(r.clienteId, [])
      m.get(r.clienteId)!.push(r)
    }
    return m
  }, [filtered])

  // Exporta a CSV
  async function exportCSV() {
    try {
      const csv = toCSV(filtered)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "ordenes.csv"; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert("Error al exportar CSV: " + (err as any).message)
    }
  }

  // Importa JSON robusto y limpia con manejo claro de tiendas extra
  async function importJSON() {
    const data = await pickJSON()
    if (!data) return
    const extraStores = [db.piezas, db.adjuntos].filter(Boolean)
    try {
      await db.transaction(
        "rw",
        db.clientes,
        db.equipos,
        db.ordenes,
        db.eventos,
        ...extraStores,
        async () => {
          await db.clientes.clear(); await db.equipos.clear()
          await db.ordenes.clear(); await db.eventos.clear()
          if (db.piezas) await db.piezas.clear()
          if (db.adjuntos) await db.adjuntos.clear()
          if (data.clientes) await db.clientes.bulkAdd(data.clientes)
          if (data.equipos)   await db.equipos.bulkAdd(data.equipos)
          if (data.ordenes)   await db.ordenes.bulkAdd(data.ordenes)
          if (data.eventos)   await db.eventos.bulkAdd(data.eventos)
          if (data.piezas)    await db.piezas?.bulkAdd(data.piezas)
          if (data.adjuntos)  await db.adjuntos?.bulkAdd(data.adjuntos)
        }
      )
      alert("Importación completada")
    } catch (e: any) {
      alert("Error en importación: " + (e?.message || e))
    }
  }

  // Sincronización robusta
  async function syncPush() {
    try { await pushAllSupabase(); alert("Copia subida a Supabase"); }
    catch (e: any) { alert("Error al subir: " + (e?.message || e)) }
  }
  async function syncPull() {
    try {
      const ok = await pullLatestSupabase()
      alert(ok ? "Datos descargados de Supabase" : "No hay copias en Supabase")
    } catch (e: any) { alert("Error al bajar: " + (e?.message || e)) }
  }

  return (
    <section className="grid gap-3">
      <div className="card">
        <div className="card-body">
          <div className="grid lg:grid-cols-5 gap-2">
            <input className="input" placeholder="Buscar por código, cliente, teléfono o equipo" value={q} onChange={e => setQ(e.target.value)} />
            <select className="input" value={estado} onChange={e => setEstado(e.target.value as any)}>
              <option value="todos">Todos</option>
              <option value="recepcion">recepcion</option>
              <option value="diagnostico">diagnostico</option>
              <option value="reparacion">reparacion</option>
              <option value="listo">listo</option>
              <option value="entregado">entregado</option>
            </select>
            <input className="input" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            <input className="input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
            <select className="input" value={ordenar} onChange={e => setOrdenar(e.target.value as any)}>
              <option value="act_desc">Act. reciente</option>
              <option value="act_asc">Act. antigua</option>
              <option value="creada_desc">Creada reciente</option>
              <option value="creada_asc">Creada antigua</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn" onClick={importJSON}>Importar JSON</button>
            <button className="btn" onClick={syncPush}>Subir Supabase</button>
            <button className="btn" onClick={syncPull}>Bajar Supabase</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Teléfono</th>
                  <th className="py-2 pr-3">Resumen</th>
                  <th className="py-2 pr-3">Actualizada</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {Array.from(groups.entries()).map(([clienteId, list]) => {
                  if (!list.length) return null
                  const first = list[0]
                  const extra = Math.max(0, list.length - 1)
                  const isOpen = !!expanded[clienteId]
                  return (
                    <tr key={clienteId} className="border-t border-neutral-200/70 dark:border-neutral-800">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{first.cliente || "(sin nombre)"}</span>
                          {extra > 0 && (
                            <button
                              className="px-2 py-0.5 rounded-lg text-xs border border-neutral-300 dark:border-neutral-700"
                              title="Ver todos"
                              onClick={() => setExpanded(s => ({ ...s, [clienteId]: !isOpen }))}
                            >+{extra}</button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{first.telefono}</td>
                      <td className="py-2 pr-3">{first.equipo} ({first.codigo})</td>
                      <td className="py-2 pr-3">{new Date(first.actualizada).toLocaleString()}</td>
                      <td className="py-2 flex gap-2">
                        <button className="btn btn-primary" onClick={() => onOpen(first.id)}>Abrir</button>
                        <button className="btn" onClick={async () => {
                          if (confirm("¿Borrar esta orden?")) await deleteOrdenCascade(first.id)
                        }}>Eliminar</button>
                      </td>
                    </tr>
                  )
                })}
                {/* Filas expandidas */}
                {Array.from(groups.entries()).map(([clienteId, list]) => {
                  const isOpen = !!expanded[clienteId]
                  if (!isOpen || list.length <= 1) return null
                  return list.slice(1).map(r => (
                    <tr key={r.id} className="border-t border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40">
                      <td className="py-2 pr-3 pl-8">{"\u2192"} {r.cliente}</td>
                      <td className="py-2 pr-3">{r.telefono}</td>
                      <td className="py-2 pr-3">{r.equipo} ({r.codigo})</td>
                      <td className="py-2 pr-3">{new Date(r.actualizada).toLocaleString()}</td>
                      <td className="py-2 flex gap-2">
                        <button className="btn btn-primary" onClick={() => onOpen(r.id)}>Abrir</button>
                        <button className="btn" onClick={async () => {
                          if (confirm("¿Borrar esta orden?")) await deleteOrdenCascade(r.id)
                        }}>Eliminar</button>
                      </td>
                    </tr>
                  ))
                })}
                {filtered.length === 0 && (
                  <tr><td className="py-4 opacity-70" colSpan={5}>Sin resultados.</td></tr>
                )}
              </tbody>
            </table>
            {/* Solo un bloque de acciones al pie de la tabla */}
            <div className="mt-3 flex gap-2">
              <button className="btn" onClick={exportCSV}>Exportar CSV</button>
              <button className="btn" onClick={importJSON}>Importar JSON</button>
              <button className="btn" onClick={syncPush}>Subir Supabase</button>
              <button className="btn" onClick={syncPull}>Bajar Supabase</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
