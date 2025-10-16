import { useEffect, useState } from "react"
import { supabase } from "../data/supabase"

type Presupuesto = {
  id: number
  horas: number
  tarifa: number
  piezas: number
  mano_obra: number
  total: number
  created_at?: string
}

export function ListaPresupuestos() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from("presupuestos").select("*").order("id", { ascending: false })
      if (error) {
        alert("Error al obtener presupuestos: " + error.message)
      } else {
        setPresupuestos(data)
      }
      setCargando(false)
    }

    fetchData()
  }, [])

  if (cargando) return <p className="p-4">Cargando presupuestos...</p>

  return (
    <section className="p-4 grid gap-4">
      <h2 className="text-xl font-bold">Presupuestos guardados</h2>
      <table className="table-auto w-full border border-neutral-200">
        <thead>
          <tr className="bg-neutral-100">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Horas</th>
            <th className="p-2 text-left">Tarifa</th>
            <th className="p-2 text-left">Piezas</th>
            <th className="p-2 text-left">Mano de Obra</th>
            <th className="p-2 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          {presupuestos.map(p => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.id}</td>
              <td className="p-2">{p.horas}</td>
              <td className="p-2">{p.tarifa}</td>
              <td className="p-2">{p.piezas}</td>
              <td className="p-2">{p.mano_obra.toFixed(2)}</td>
              <td className="p-2 font-semibold">{p.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
