import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { forceSync } from '../../sync/autosync'; // 💡 Importar función de sincronización

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

type GrupoCliente = {
  clienteId: string
  nombre: string
  telefono: string
  totalOrdenes: number
  ordenes: OrdenRow[]
}

// Funciones de utilidad CSV/JSON
function toCSV(rows: OrdenRow[]) {
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const head = ['ID', 'Código', 'Estado', 'Cliente', 'Teléfono', 'Equipo', 'Creada', 'Actualizada']
  const lines = [head.join(',')].concat(
    rows.map(r => [
      r.id, r.codigo, r.estado, r.cliente, r.telefono, r.equipo,
      new Date(r.creada).toLocaleString(), new Date(r.actualizada).toLocaleString()
    ].map(esc).join(','))
  )
  return lines.join('\r\n')
}

async function pickJSON(): Promise<any | null> {
  return new Promise(res => {
    const i = document.createElement('input')
    i.type = 'file'; i.accept = 'application/json'
    i.onchange = async () => {
      const f = i.files?.[0]; if (!f) { res(null); return }
      try { const data = JSON.parse(await f.text()); res(data) } catch { res(null) }
    }
    i.click()
  })
}
// ----------------------------------------------------


export function Ordenes({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'todos' | 'recepcion' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [ordenar, setOrdenar] = useState<'creada_desc' | 'creada_asc' | 'act_desc' | 'act_asc'>('act_desc')
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false); // 💡 Estado para el botón de sincronización

  const allOrdenes = useLiveQuery(() => db.ordenes.toArray(), []);
  
  const grupos = useMemo<GrupoCliente[]>(() => {
    if (!allOrdenes) return []
    
    const gruposMap: Record<string, GrupoCliente> = {}

    allOrdenes.forEach(o => {
      // 🔑 CRÍTICO: Filtra órdenes que no tienen los campos redundantes (las órdenes viejas)
      if (!o.cliente || !o.telefono || !o.equipo) {
        console.warn("Orden ignorada por falta de campos redundantes:", o.id);
        return; 
      }
      
      // Usamos una clave única para la agrupación (nombre+telefono)
      const clienteId = o.cliente + o.telefono; 

      const row: OrdenRow = {
        id: o.id,
        codigo: o.codigo,
        estado: o.estado,
        cliente: o.cliente, // Se usan los campos redundantes
        telefono: o.telefono, // Se usan los campos redundantes
        equipo: o.equipo, // Se usan los campos redundantes
        creada: o.creada,
        actualizada: o.actualizada
      }

      if (!gruposMap[clienteId]) {
        gruposMap[clienteId] = {
          clienteId,
          nombre: row.cliente,
          telefono: row.telefono,
          totalOrdenes: 0,
          ordenes: []
        };
      }
      
      gruposMap[clienteId].ordenes.push(row);
      gruposMap[clienteId].totalOrdenes++;
    });
    
    // ... (El resto de la lógica de ordenamiento y filtrado se mantiene) ...

    let list = Object.values(gruposMap);

    const t = q.trim().toLowerCase()
    const by = {
      creada_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.creada).getTime() - new Date(a.creada).getTime(),
      creada_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.creada).getTime() - new Date(b.creada).getTime(),
      act_desc: (a: OrdenRow, b: OrdenRow) => new Date(b.actualizada).getTime() - new Date(a.actualizada).getTime(),
      act_asc: (a: OrdenRow, b: OrdenRow) => new Date(a.actualizada).getTime() - new Date(b.actualizada).getTime(),
    }[ordenar]

    list = list.filter(grupo => {
        const ordenesFiltradas = grupo.ordenes.filter(r => {
            let matchesEstado = (estado === 'todos' || r.estado === estado);
            let matchesDesde = (desde ? new Date(r.creada) >= new Date(desde) : true);
            let matchesHasta = (hasta ? (new Date(r.creada).setHours(23, 59, 59, 999)) >= (new Date(hasta).getTime()) : true);
            
            return matchesEstado && matchesDesde && matchesHasta;
        }).sort(by);
        
        const matchesClient = grupo.nombre.toLowerCase().includes(t) || grupo.telefono.includes(t);
        const matchesOrder = ordenesFiltradas.some(r =>
            r.codigo.toLowerCase().includes(t) || r.equipo.toLowerCase().includes(t)
        );
        
        grupo.ordenes = ordenesFiltradas;
        
        return (matchesClient || matchesOrder) && ordenesFiltradas.length > 0;
    });

    if (expandedClienteId && !list.some(g => g.clienteId === expandedClienteId)) {
        setExpandedClienteId(null);
    }
    
    return list
  }, [allOrdenes, q, estado, desde, hasta, ordenar, expandedClienteId])


  // Función exportCSV
  function exportCSV() {
    const allRows: OrdenRow[] = grupos.flatMap(g => g.ordenes)
    
    if (allRows.length === 0) {
      alert('No hay órdenes para exportar.')
      return
    }

    const csv = toCSV(allRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Función importJSON
  async function importJSON() {
    if (!confirm('¿Estás seguro de que quieres importar datos? Esto podría añadir o sobrescribir datos si los IDs coinciden.')) return
    const data = await pickJSON()
    if (!data) return
    
    try {
      await db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, db.piezas, db.adjuntos, async () => {
        if (data.clientes) await db.clientes.bulkAdd(data.clientes).catch(() => console.warn('Advertencia: Algunos clientes ya existían o tenían un ID repetido.'))
        if (data.equipos) await db.equipos.bulkAdd(data.equipos).catch(() => console.warn('Advertencia: Algunos equipos ya existían o tenían un ID repetido.'))
        if (data.ordenes) await db.ordenes.bulkAdd(data.ordenes).catch(() => console.warn('Advertencia: Algunas órdenes ya existían o tenían un ID repetido.'))
        if (data.eventos) await db.eventos.bulkAdd(data.eventos).catch(() => console.warn('Advertencia: Algunos eventos ya existían o tenían un ID repetido.'))
        if (data.piezas) await db.piezas.bulkAdd(data.piezas).catch(() => console.warn('Advertencia: Algunas piezas ya existían o tenían un ID repetido.'))
        if (data.adjuntos) await db.adjuntos.bulkAdd(data.adjuntos).catch(() => console.warn('Advertencia: Algunos adjuntos ya existían o tenían un ID repetido.'))
      })
      alert('Datos importados correctamente.')
    } catch (e: any) {
      alert(`Error al importar datos: ${e.message}`)
    }
  }

  async function eliminarOrden(id: string) {
    if (!confirm('¿Seguro que deseas eliminar esta orden?')) return
    await db.transaction('rw', db.ordenes, db.eventos, db.piezas, db.adjuntos, async () => {
      await db.eventos.where('ordenId').equals(id).delete()
      await db.piezas.where('ordenId').equals(id).delete()
      if (db.adjuntos) await db.adjuntos.where('ordenId').equals(id).delete()
      await db.ordenes.delete(id)
    })
    alert('Orden eliminada correctamente')
  }

  // 💡 NUEVO: Función para sincronización manual
  async function handleSync() {
    setIsSyncing(true);
    try {
      await forceSync(); 
    } catch (error) {
      alert('Error al sincronizar. Revisa la consola y la conexión.');
    } finally {
      setIsSyncing(false); 
    }
  }

  return (
    <section className="grid gap-3">
      <div className="card"><div className="card-body">
        <div className="grid lg:grid-cols-5 gap-2">
          {/* ... (Filtros y inputs) ... */}
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
          
          {/* 🔑 BOTÓN DE SINCRONIZACIÓN MANUAL */}
          <button 
            className="btn btn-secondary" 
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      </div></div>
      
      {/* ... (Tabla de Grupos) ... */}
      <div className="card"><div className="card-body p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Encabezados de la tabla */}
            </thead>
            <tbody>
              {grupos.map(grupo => (
                <>
                  <tr key={grupo.clienteId} className="bg-neutral-100 dark:bg-neutral-800 font-semibold cursor-pointer" onClick={() => setExpandedClienteId(e => e === grupo.clienteId ? null : grupo.clienteId)}>
                    <td className="py-2 px-3 flex items-center gap-2" colSpan={8}>
                      {expandedClienteId === grupo.clienteId ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      Cliente: {grupo.nombre} ({grupo.telefono}) | Órdenes: {grupo.ordenes.length}
                    </td>
                  </tr>
                  {expandedClienteId === grupo.clienteId && grupo.ordenes.map(r => (
                    <tr key={r.id} className="border-t border-neutral-200/70 dark:border-neutral-800">
                      <td className="py-2 pr-3 pl-8">{r.codigo}</td>
                      <td className="py-2 pr-3">{r.cliente}</td>
                      <td className="py-2 pr-3">{r.telefono}</td>
                      <td className="py-2 pr-3">{r.equipo}</td>
                      <td className="py-2 pr-3">{r.estado}</td>
                      <td className="py-2 pr-3">{new Date(r.creada).toLocaleString()}</td>
                      <td className="py-2 pr-3">{new Date(r.actualizada).toLocaleString()}</td>
                      <td className="py-2 flex gap-2">
                        <button className="btn btn-primary" onClick={() => onOpen(r.id)}>Abrir</button>
                        <button className="btn" onClick={() => eliminarOrden(r.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
              {grupos.length === 0 && (
                <tr><td className="py-4 opacity-70 px-4" colSpan={8}>No se encontraron órdenes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div></div>
    </section>
  )
}