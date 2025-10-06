import { useState } from 'react'

export function Presupuesto(){
  const [horas, setHoras] = useState(1)
  const [tarifa, setTarifa] = useState(25)
  const [piezas, setPiezas] = useState(0)

  const manoObra = horas * tarifa
  const total = manoObra + piezas // SIN IVA

  return (
    <section className="grid gap-4">
      <div className="card"><div className="card-body grid gap-4">
        <h2 className="text-lg font-semibold">{"Presupuesto inicial"}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={"Horas"}><input type="number" className="input" value={horas} onChange={e=>setHoras(parseFloat(e.target.value)||0)}/></Field>
          <Field label={"Tarifa \u20AC/h"}><input type="number" className="input" value={tarifa} onChange={e=>setTarifa(parseFloat(e.target.value)||0)}/></Field>
          <Field label={"Piezas \u20AC"}><input type="number" className="input" value={piezas} onChange={e=>setPiezas(parseFloat(e.target.value)||0)}/></Field>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label={"Mano de obra"} value={manoObra}/>
          <KPI label={"Piezas"} value={piezas}/>
          <KPI label={"Total"} value={total} strong/>
        </div>
      </div></div>
    </section>
  )
}
function KPI({label, value, strong}:{label:string; value:number; strong?:boolean}){ return (<div className="card"><div className="card-body"><div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div><div className={`text-xl ${strong?'font-bold':''}`}>{value.toFixed(2)}</div></div></div>) }
function Field({label, children}:{label:string; children:React.ReactNode}){ return (<label className="grid gap-1"><span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>{children}</label>) }
