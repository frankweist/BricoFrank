import { useState, useCallback } from "react";
import { Layout } from "./modules/app/Layout";
import { Ordenes } from "./modules/ordenes/Ordenes";
import { Registro } from "./modules/registro/Registro";
import { DetalleOrden } from "./modules/reparacion/DetalleOrden";
import { Informes } from "./modules/informes/Informes";
import { Presupuesto } from "./modules/presupuesto/Presupuesto";
import { ListaPresupuestos } from "./modules/informes/ListaPresupuestos";
import { Historial } from "./modules/historial/Historial";

// Tipos de pestaña
export type Tab =
  | "ordenes"
  | "registro"
  | "reparacion"
  | "informes"
  | "presupuesto"
  | "listapresupuestos"
  | "historial";

export function App() {
  const [tab, setTab] = useState<Tab>("ordenes");
  const [selId, setSelId] = useState<string | null>(null);

  // Navegar desde Registro al Detalle de Reparación
  const openDetailFromRegistro = useCallback((ordenId: string) => {
    setSelId(ordenId);
    setTab("reparacion");
  }, []);

  // Abrir Detalle desde la lista de Órdenes
  const openDetailFromOrdenes = useCallback((ordenId: string) => {
    setSelId(ordenId);
    setTab("reparacion");
  }, []);

  // Volver a la lista de Órdenes
  const goBackToOrdenes = useCallback(() => {
    setSelId(null);
    setTab("ordenes");
  }, []);

  const navigateToPresupuesto = useCallback(() => {
    setTab("presupuesto");
  }, []);

  return (
    <Layout tab={tab} onTab={setTab}>
      {/* 1. REGISTRO DE NUEVA ORDEN */}
      {tab === "registro" && <Registro onCreated={openDetailFromRegistro} />}

      {/* 2. LISTA DE ÓRDENES */}
      {tab === "ordenes" && <Ordenes onOpen={openDetailFromOrdenes} />}

      {/* 3. DETALLE DE REPARACIÓN */}
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
              <DetalleOrden ordenId={selId} onNavigateToBudget={navigateToPresupuesto} />



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

      {/* 4. INFORMES */}
      {tab === "informes" && <Informes />}

      {/* 5. PRESUPUESTOS */}
      {tab === "presupuesto" && <Presupuesto />}
      {tab === "listapresupuestos" && <ListaPresupuestos />}

      {/* 6. HISTORIAL */}
      {tab === "historial" && <Historial />}
    </Layout>
  );
}
