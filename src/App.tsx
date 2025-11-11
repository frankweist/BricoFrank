import { useState, useCallback } from "react";
import { Layout } from "./modules/app/Layout";
import { Ordenes } from "./modules/ordenes/Ordenes";
import { Registro } from "./modules/registro/Registro";
import { DetalleOrden } from "./modules/reparacion/DetalleOrden";
import { Informes } from "./modules/informes/Informes";
import { Presupuesto } from "./modules/presupuesto/Presupuesto";
import { ListaPresupuestos } from "./modules/informes/ListaPresupuestos";
import { Historial } from "./modules/historial/Historial";
import { Componentes } from "./modules/componentes/Componentes";


export type Tab =
  | "ordenes"
  | "registro"
  | "reparacion"
  | "informes"
  | "presupuesto"
  | "listapresupuestos"
  | "historial"
  | "componentes";

export function App() {
  const [tab, setTab] = useState<Tab>("ordenes");
  const [selId, setSelId] = useState<string | null>(null);

  const openDetailFromRegistro = useCallback((ordenId: string) => {
    setSelId(ordenId);
    setTab("reparacion");
  }, []);

  const openDetailFromOrdenes = useCallback((ordenId: string) => {
    setSelId(ordenId);
    setTab("reparacion");
  }, []);

  const goBackToOrdenes = useCallback(() => {
    setTab("ordenes");
  }, []);

  const navigateToPresupuesto = useCallback(() => {
    if (!selId) return;
    setTab("presupuesto");
  }, [selId]);

  return (
    <Layout tab={tab} onTab={setTab}>
      {tab === "registro" && <Registro onCreated={openDetailFromRegistro} />}

      {tab === "ordenes" && <Ordenes onOpen={openDetailFromOrdenes} />}

      {tab === "reparacion" && (
        <div className="grid grid-cols-1 gap-4">
          {selId ? (
            <>
              <button
                className="btn btn-secondary w-fit mb-2"
                onClick={goBackToOrdenes}
              >
                ← Volver a Órdenes
              </button>
              <DetalleOrden
                ordenId={selId}
                onNavigateToBudget={navigateToPresupuesto}
              />
            </>
          ) : (
            <div className="card">
              <div className="card-body">
                Selecciona una orden desde <b>Órdenes</b> para ver los detalles.
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "informes" && <Informes />}

      {/* ✅ ahora Presupuesto recibe la orden seleccionada */}
      {tab === "presupuesto" && <Presupuesto ordenId={selId} />}

      {tab === "listapresupuestos" && <ListaPresupuestos />}

      {tab === "historial" && <Historial />}
	  {tab === "componentes" && <Componentes />}

    </Layout>
  );
}
