import { useState } from "react"

// KPI: Incluye el símbolo de moneda '€' en el valor y formatea el número
function KPI({label, value, strong}:{label:string; value:number; strong?:boolean}){
  // Usamos el formato internacional para garantizar el separador de miles y la moneda.
  const formattedValue = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

  return (<div className="card"><div className="card-body">
    <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    <div className={`text-xl ${strong?'font-bold':''}`}>{formattedValue}</div>
  </div></div>)
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (<label className="grid gap-1"><span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>{children}</label>)
}

export function Presupuesto(){
  const [horas, setHoras] = useState(1);
  const [tarifa, setTarifa] = useState(25);
  const [piezas, setPiezas] = useState(0);
  
  // La lógica es simple: Total = Mano de Obra + Piezas
  const manoObra = horas * tarifa;
  const subtotal = manoObra + piezas;
  const total = subtotal; // Total es igual al Subtotal (sin IVA)

  return (<section className="grid gap-4"><div className="card"><div className="card-body grid gap-4">
    <h2 className="text-lg font-semibold">Cálculo de Coste Aproximado</h2>
    
    <div className="grid sm:grid-cols-3 gap-3">
      <Field label="Horas estimadas"><input type="number" className="input" value={horas} onChange={e=>setHoras(parseFloat(e.target.value)||0)}/></Field>
      <Field label={'Tarifa de mano de obra €/h'}><input type="number" className="input" value={tarifa} onChange={e=>setTarifa(parseFloat(e.target.value)||0)}/></Field>
      <Field label={'Coste estimado de Piezas €'}><input type="number" className="input" value={piezas} onChange={e=>setPiezas(parseFloat(e.target.value)||0)}/></Field>
    </div>
    
    {/* Tres KPIs de resultado, sin el cálculo de IVA */}
    <div className="grid sm:grid-cols-3 md:grid-cols-3 gap-3">
      <KPI label="Mano de obra" value={manoObra}/>
      <KPI label="Subtotal (Base)" value={subtotal}/>
      <KPI label="TOTAL APROXIMADO" value={total} strong/>
    </div>
  </div></div></section>)
}