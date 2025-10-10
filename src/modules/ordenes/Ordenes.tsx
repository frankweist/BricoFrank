import { pushNow as syncPushNow, pullNow as syncPullNow } from '../../sync/autosync';
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

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

function toCSV(rows: OrdenRow[]) {
  const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
  const head = ['ID','Codigo','Estado','Cliente','Telefono','Equipo','Creada','Actualizada']
  const lines = [head.join(',')].concat(
    rows.map(r => [
      r.id, r.codigo, r.estado, r.cliente, r.telefono, r.equipo,
      new Date(r.creada).toLocaleString(), new Date(r.actualizada).toLocaleString()
    ].map(esc).join(','))
  )
  return lines.join('\r\n')
}

async function pickJSON(): Promise<any|null>{
  return new Promise(res=>{
    const i = document.createElement('input')
    i.type = 'file'; i.accept = 'application/json'
    i.onchange = async () => {
      const f = i.files?.[0]; if(!f){ res(null); return }
      try { const data = JSON.parse(await f.text()); res(data) } catch { res(null) }
    }
    i.click()
  })
}

export function Ordenes({ onOpen }:{ onOpen:(id:string)=>void }){
  const clientes = useLiveQuery(()=> db.clientes.toArray(), [])
  const equipos  = useLiveQuery(()=> db.equipos.toArray(),  [])
  const ordenes  = useLiveQuery(()=> db.ordenes.toArray(),  [])

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'todos'|'recepcion'|'diagnostico'|'reparacion'|'listo'|'entregado'>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [ordenar, setOrdenar] = useState<'creada_desc'|'creada_asc'|'act_desc'|'act_asc'>('act_desc')

  // set de clientes expandidos
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

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
        clienteId: cl?.id || '',
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

  // Agrupar por clienteId
  const grupos = useMemo(()=>{
    const map = new Map<string, OrdenRow[]>()
    for(const r of filtered){
      const arr = map.get(r.clienteId) || []
      arr.push(r)
      map.set(r.clienteId, arr)
    }
    return map
  }, [filtered])

  const planoParaCSV = useMemo(()=> filtered, [filtered])

  async function exportCSV(){
    const csv = toCSV(planoParaCSV)
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ordenes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function importJSON(){
    const data = await pickJSON()
    if(!data) return
    await db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, db.piezas, db.adjuntos, async ()=>{
      await db.clientes.clear(); await db.equipos.clear()
      await db.ordenes.clear();  await db.eventos.clear(); await db.piezas.clear()
      if(db.adjuntos) await db.adjuntos.clear()
      await db.clientes.bulkAdd(data.clientes||[])
      await db.equipos.bulkAdd(data.equipos||[])
      await db.ordenes.bulkAdd(data.ordenes||[])
      await db.eventos.bulkAdd(data.eventos||[])
      if(data.piezas)   await db.piezas.bulkAdd(data.piezas)
      if(data.adjuntos && db.adjuntos) await db.adjuntos.bulkAdd(data.adjuntos)
    })
    alert('Importación completada')
  }

  function toggleGrupo(clienteId:string){
    setExpandidos(prev=>{
      const n = new Set(prev)
      if(n.has(clienteId)) n.delete(clienteId); else n.add(clienteId)
      return n
    })
  }

  return (
    <section className="grid gap-3">
      <div className="card"><div className="card-body">
        <div className="grid lg:grid-cols-5 gap-2">
          <input className="input" placeholder="Buscar por código, cliente, teléfono o equipo" value={q} onChange={e=>setQ(e.target.value)} />
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
        <div className="mt-3 flex gap-2">
                    <button className="btn" onClick={()=>syncPushNow()}>Subir Supabase</button>
          <button className="btn" onClick={()=>syncPullNow()}>Bajar Supabase</button><button className="btn" onClick={exportCSV}>Exportar CSV</button>
          <button className="btn" onClick={importJSON}>Importar JSON</button>
        </div>
      </div></div>

      <div className="card"><div className="card-body">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-2 pr-3">Código / Cliente</th>
                <th className="py-2 pr-3">Teléfono</th>
                <th className="py-2 pr-3">Equipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Creada</th>
                <th className="py-2 pr-3">Actualizada</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...grupos.entries()].map(([clienteId, arr])=>{
                // cabecera de grupo
                const first = arr[0]
                const multi = arr.length > 1
                const abierto = expandidos.has(clienteId)
                return (
                  <FragmentGroup key={clienteId}>
                    <tr className="border-t border-neutral-200/70 dark:border-neutral-800">
                      <td className="py-2 pr-3">
                        {multi && (
                          <button className="btn mr-2" onClick={()=>toggleGrupo(clienteId)}>
                            {abierto ? '−' : `+${arr.length-1}`}
                          </button>
                        )}
                        <span className="font-medium">{first.cliente || '(Sin cliente)'}</span>
                        <span className="opacity-60 ml-2">· {first.codigo}</span>
                      </td>
                      <td className="py-2 pr-3">{first.telefono}</td>
                      <td className="py-2 pr-3">{first.equipo}</td>
                      <td className="py-2 pr-3">{first.estado}</td>
                      <td className="py-2 pr-3">{new Date(first.creada).toLocaleString()}</td>
                      <td className="py-2 pr-3">{new Date(first.actualizada).toLocaleString()}</td>
                      <td className="py-2"><button className="btn btn-primary" onClick={()=>onOpen(first.id)}>Abrir</button></td>
                    </tr>
                    {multi && abierto && arr.slice(1).map(r=>(
                      <tr key={r.id} className="border-t border-neutral-200/70 dark:border-neutral-800">
                        <td className="py-2 pr-3 pl-10">
                          <span className="opacity-60 mr-2">↳</span>{r.codigo}
                        </td>
                        <td className="py-2 pr-3">{r.telefono}</td>
                        <td className="py-2 pr-3">{r.equipo}</td>
                        <td className="py-2 pr-3">{r.estado}</td>
                        <td className="py-2 pr-3">{new Date(r.creada).toLocaleString()}</td>
                        <td className="py-2 pr-3">{new Date(r.actualizada).toLocaleString()}</td>
                        <td className="py-2"><button className="btn btn-primary" onClick={()=>onOpen(r.id)}>Abrir</button></td>
                      </tr>
                    ))}
                  </FragmentGroup>
                )
              })}
              {filtered.length===0 && (
                <tr><td className="py-4 opacity-70" colSpan={7}>Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div></div>
    </section>
  )
}

// pequeño helper para evitar keys duplicadas en fragmentos
function FragmentGroup({children}:{children:React.ReactNode}){ return <>{children}</> }

