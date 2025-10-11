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

function toCSV(rows: OrdenRow[]) {
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const head = ['ID', 'Codigo', 'Estado', 'Cliente', 'Telefono', 'Equipo', 'Creada', 'Actualizada']
  const lines = [head.join(',')].concat(
    rows.map(r =>
      [
        r.id,
        r.codigo,
        r.estado,
        r.cliente,
        r.telefono,
        r.equipo,
        new Date(r.creada).toLocaleString(),
        new Date(r.actualizada).toLocaleString(),
      ]
        .map(esc)
        .join(',')
    )
  )
  return lines.join('\r\n')
}

async function pickJSON(): Promise<any | null> {
  return new Promise(res => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = 'application/json'
    i.onchange = async () => {
      const f = i.files?.[0]
      if (!f) {
        res(null)
        return
      }
      try {
        const data = JSON.parse(await f.text())
        res(data)
      } catch {
        res(null)
      }
    }
    i.click()
  })
}

export function Ordenes({ onOpen }: { onOpen: (id: string) => void }) {
  const clientes = useLiveQuery(() => db.clientes.toArray(), [])
  const equipos = useLiveQuery(() => db.equipos.toArray(), [])
  const ordenes = useLiveQuery(() => db.ordenes.toArray(), [])

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'todos' | 'recepcion' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'>('todos')
  const [desde, setDesde] = useState('') // yyyy-mm-dd
  const [hasta, setHasta] = useState('')
  const [ordenar, setOrdenar] = useState<'creada_desc' | 'creada_asc' | 'act_desc' | 'act_asc'>('act_desc')

  const rows = useMemo<OrdenRow[]>(() => {
    if (!clientes || !equipos || !ordenes) return []
    const byCliente = new Map(clientes.map(c => [c.id, c]))
    const byEquipo = new Map(equipos.map(e => [e.id, e]))
    return ordenes.map(o => {
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
        actualizada: o.actualizada,
      }
    })
  }, [clientes, equipos, ordenes])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    let list = rows
    if (t) {
      list = list.filter(
        r =>
          r.codigo.toLowerCase().includes(t) ||
          r.cliente.toLowerCase().includes(t) ||
          r.telefono.toLowerCase().includes(t) ||
          r.equipo.toLowerCase().includes(t) ||
          r.estado.toLowerCase().includes(t)
      )
    }
    if (estado !== 'todos') list = list.filter(r => r.estado === estado)
    if (desde) {
      const d = new Date(desde)
      list = list.filter(r => new Date(r.creada) >= d)
    }
    if (hasta) {
      const h = new Date(hasta)
      h.setHours(23, 59, 59, 999)
      list = list.filter(r => new Date(r.creada) <= h)
    }
    const by = {
      creada_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.creada).getTime() - new Date(a.creada).getTime(),
      creada_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.creada).getTime() - new Date(b.creada).getTime(),
      act_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.actualizada).getTime() - new Date(a.actualizada).getTime(),
      act_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.actualizada).getTime() - new Date(b.actualizada).getTime(),
    }[ordenar]
    return [...list].sort(by)
  }, [rows, q, estado, desde, hasta, ordenar])

  async function exportCSV() {
    const csv = toCSV(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ordenes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJSON() {
    const data = await pickJSON()
    if (!data) return
    await db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, db.piezas, db.adjuntos, async () => {
      await db.clientes.clear()
      await db.equipos.clear()
      await db.ordenes.clear()
      await db.eventos.clear()
      await db.piezas.clear()
      if (db.adjuntos) await db.adjuntos.clear()
      await db.clientes.bulkAdd(data.clientes || [])
      await db.equipos.bulkAdd(data.equipos || [])
      await db.ordenes.bulkAdd(data.ordenes || [])
      await db.eventos.bulkAdd(data.eventos || [])
      if (data.piezas) await db.piezas.bulkAdd(data.piezas)
      if (data.adjuntos && db.adjuntos) await db.adjuntos.bulkAdd(data.adjuntos)
    })
    alert('Importación completada')
  }

  async function eliminarOrden(ordenId: string) {
    const ok = window.confirm('¿Eliminar esta orden? Se borrarán notas, piezas y adjuntos asociados.')
    if (!ok) return
    await db.transaction('rw', db.ordenes, db.eventos, db.piezas, db.adjuntos, async () => {
      await db.eventos.where('ordenId').equals(ordenId).delete()
      await db.piezas.where('ordenId').equals(ordenId).delete()
      if (db.adjuntos) await db.adjuntos.where('ordenId').equals(ordenId).delete()
      await db.ordenes.delete(ordenId)
    })
  }

  return (
    <section className="grid gap-3">
      <div className="card">
        <div className="card-body">
          <div className="grid lg:grid-cols-5 gap-2">
            <input
              className="input"
              placeholder="Buscar por código, cliente, teléfono o equipo"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
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
            <button className="btn" onClick={exportCSV}>
              Exportar CSV
            </button>
            <button className="btn" onClick={importJSON}>
              Importar JSON
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Teléfono</th>
                  <th className="py-2 pr-3">Equipo</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Creada</th>
                  <th className="py-2 pr-3">Actualizada</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-neutral-200/70 dark:border-neutral-800">
                    <td className="py-2 pr-3">{r.codigo}</td>
                    <td className="py-2 pr-3">{r.cliente}</td>
                    <td className="py-2 pr-3">{r.telefono}</td>
                    <td className="py-2 pr-3">{r.equipo}</td>
                    <td className="py-2 pr-3">{r.estado}</td>
                    <td className="py-2 pr-3">{new Date(r.creada).toLocaleString()}</td>
                    <td className="py-2 pr-3">{new Date(r.actualizada).toLocaleString()}</td>
                    <td className="py-2 flex gap-2">
                      <button className="btn btn-primary" onClick={() => onOpen(r.id)}>
                        Abrir
                      </button>
                      <button className="btn" onClick={() => eliminarOrden(r.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="py-4 opacity-70" colSpan={8}>
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
