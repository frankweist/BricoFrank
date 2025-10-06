import { useState } from 'react'
import { Layout } from './modules/app/Layout'
import { Registro } from './modules/registro/Registro'
import { Presupuesto } from './modules/presupuesto/Presupuesto'
import { DetalleOrden } from './modules/reparacion/DetalleOrden'
import { Ordenes } from './modules/ordenes/Ordenes'

export type Tab = 'registro'|'ordenes'|'presupuesto'|'reparacion'

export default function App(){
  const [tab, setTab] = useState<Tab>('registro')

  function openOrden(id:string){
    sessionStorage.setItem('ordenActual', id)
    setTab('reparacion')
  }

  return (
    <Layout tab={tab} onTab={setTab}>
      {tab==='registro'    && <Registro onCreated={openOrden} />}
      {tab==='ordenes'     && <Ordenes onOpen={openOrden} />}
      {tab==='presupuesto' && <Presupuesto/>}
      {tab==='reparacion'  && <DetalleOrden ordenId={sessionStorage.getItem('ordenActual')||''}/>}
    </Layout>
  )
}
