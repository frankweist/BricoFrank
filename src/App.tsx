import React, { useState } from "react"
import { Layout } from "./modules/app/Layout"
import { Registro } from "./modules/registro/Registro"
import { Ordenes } from "./modules/ordenes/Ordenes"
import { Presupuesto } from "./modules/presupuesto/Presupuesto"
import { DetalleOrden } from "./modules/reparacion/DetalleOrden"
import { Informes } from "./modules/informes/Informes"
import './sync/autosync'

// Se añade "informes" al tipo Tab
export type Tab = "registro"|"ordenes"|"presupuesto"|"reparacion"|"informes" 

export default function App(){
  const [tab,setTab] = useState<Tab>("ordenes")
  const [selId,setSelId] = useState<string|undefined>(undefined)

  return (
    <Layout tab={tab} onTab={(t)=>{
      setTab(t)
      if(t==="reparacion" && !selId){
        // sin orden seleccionada, permanece pero mostrará aviso
      }
    }}>
      {tab==="registro" && (
        <Registro onCreated={(id)=>{ setSelId(id); setTab("reparacion") }} />
      )}
      {tab==="ordenes" && (
        <Ordenes onOpen={(id)=>{ setSelId(id); setTab("reparacion") }} />
      )}
      {tab==="presupuesto" && <Presupuesto />}
      {tab==="reparacion" && (
        selId ? <DetalleOrden ordenId={selId}/> :
        <div className="card"><div className="card-body">Selecciona una orden desde “Órdenes”.</div></div>
      )}
      {tab==="informes" && <Informes />} 
    </Layout>
  )
}