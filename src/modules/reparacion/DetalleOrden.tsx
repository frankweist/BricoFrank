import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { supa } from "../../data/supabase";

type ClienteData = { nombre: string; telefono: string; email?: string } | string;
type EquipoData = {
  aparato?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  descripcion?: string;
} | string;

type Orden = {
  id: string;
  codigo: string;
  estado: string;
  presupuestoAprox?: number | null;
  horasReparacion?: number;
  tarifa?: number;
  piezas?: any[];
  cliente: ClienteData;
  telefono?: string;
  equipo: EquipoData;
  equipoId?: string;
  trabajoRealizado?: string;
  archivos?: string[] | null;
  creada: string;
};

function PresupuestoSummary({
  orden,
  onNavigateToBudget,
}: {
  orden: Orden;
  onNavigateToBudget: () => void;
}) {
  const horas = orden.horasReparacion ?? 0;
  const tarifa = orden.tarifa ?? 25;
  const piezas = orden.piezas || [];
  const margen = 1.15;
  const costePiezas =
    piezas.reduce((s: number, p: any) => s + (p.precio || 0), 0) * margen;
  const manoObra = horas * tarifa;

  return (
    <div className="card">
      <div className="card-body grid gap-3">
        <h2 className="text-lg font-semibold">Resumen de Presupuesto</h2>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div className="text-sm">
            Horas: <b>{horas}</b>
          </div>
          <div className="text-sm">
            Mano de Obra: <b>{manoObra.toFixed(2)} €</b>
          </div>
          <div className="text-sm">
            Coste Piezas (+15%): <b>{costePiezas.toFixed(2)} €</b>
          </div>
          <div className="text-lg font-bold p-2 bg-indigo-100 text-indigo-800 rounded-lg">
            Total:{" "}
            {(orden.presupuestoAprox ?? manoObra + costePiezas).toFixed(2)} €
          </div>
        </div>
        <button
          className="btn btn-primary w-full mt-2"
          onClick={onNavigateToBudget}
        >
          📝 Ir a Presupuesto
        </button>
      </div>
    </div>
  );
}

const estados = [
  { id: "recepcion", label: "Recepción" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "reparacion", label: "Reparación" },
  { id: "listo", label: "Listo" },
  { id: "entregado", label: "Entregado" },
];

export function DetalleOrden({
  ordenId,
  onNavigateToBudget,
}: {
  ordenId: string;
  onNavigateToBudget: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [remoteFiles, setRemoteFiles] = useState<any[]>([]);
  const [localFiles, setLocalFiles] = useState<File[] | null>(null);
  const [trabajoRealizado, setTrabajoRealizado] = useState("");
  const [equipoExtra, setEquipoExtra] = useState<any>(null);

  const orden = useLiveQuery(
    () => (ordenId ? db.ordenes.get(ordenId) : Promise.resolve(undefined)),
    [ordenId]
  ) as Orden | undefined;

  useEffect(() => {
    if (orden && orden.equipoId) {
      db.equipos.get(orden.equipoId).then((eq) => {
        if (eq) setEquipoExtra(eq);
      });
    }
  }, [orden]);

  useEffect(() => {
    if (orden) setTrabajoRealizado(orden.trabajoRealizado || "");
  }, [orden]);

  useEffect(() => {
    if (!ordenId) return;
    (async () => {
      const { data } = await supa.storage.from("adjuntos").list(ordenId);
      setRemoteFiles(data || []);
    })();
  }, [ordenId]);

  useEffect(() => {
    if (!orden || trabajoRealizado === (orden.trabajoRealizado || "")) return;
    const t = setTimeout(async () => {
      await db.ordenes.update(ordenId, {
        trabajoRealizado,
        actualizada: new Date().toISOString(),
      });
      setToast("Guardado automático.");
    }, 1000);
    return () => clearTimeout(t);
  }, [trabajoRealizado, orden, ordenId]);

  async function actualizarEstado(e: string) {
    await db.ordenes.update(ordenId, {
      estado: e,
      actualizada: new Date().toISOString(),
    });
    setToast(`Estado actualizado: ${e}`);
  }

  async function subirAdjuntos() {
    if (!localFiles?.length) return;
    await Promise.all(
      localFiles.map((f) =>
        supa.storage.from("adjuntos").upload(`${ordenId}/${f.name}`, f)
      )
    );
    await db.ordenes.update(ordenId, {
      archivos: [...(orden?.archivos || []), ...localFiles.map((f) => f.name)],
    });
    setToast(`Subidos ${localFiles.length} archivo(s).`);
    setLocalFiles(null);
  }

  async function borrarAdjunto(name: string) {
    await supa.storage.from("adjuntos").remove([`${ordenId}/${name}`]);
    const updated = (orden?.archivos || []).filter((f) => f !== name);
    await db.ordenes.update(ordenId, { archivos: updated });
    setToast(`Adjunto eliminado: ${name}`);
  }

  if (!orden) return <p className="text-sm opacity-70">Cargando detalles...</p>;

  const cliente =
    typeof orden.cliente === "object"
      ? orden.cliente
      : { nombre: orden.cliente || "—", telefono: orden.telefono || "—" };

  const equipo =
    typeof orden.equipo === "object"
      ? {
          aparato: orden.equipo.aparato || equipoExtra?.aparato || "—",
          marca: orden.equipo.marca || equipoExtra?.marca || "—",
          modelo: orden.equipo.modelo || equipoExtra?.modelo || "—",
          numeroSerie:
            orden.equipo.numeroSerie || equipoExtra?.numeroSerie || "—",
          descripcion:
            orden.equipo.descripcion || equipoExtra?.descripcion || "—",
        }
      : {
          aparato: (orden.equipo as string) || equipoExtra?.aparato || "—",
          marca: equipoExtra?.marca || "—",
          modelo: equipoExtra?.modelo || "—",
          numeroSerie: equipoExtra?.numeroSerie || "—",
          descripcion: equipoExtra?.descripcion || "—",
        };

  return (
    <section className="grid gap-4">
      <div className="card">
        <div className="card-body grid sm:grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-semibold">Cliente</h2>
            <p>
              <b>Nombre:</b> {cliente.nombre}
            </p>
            <p>
              <b>Teléfono:</b> {cliente.telefono}
            </p>
            {"email" in cliente && cliente.email && (
              <p>
                <b>Email:</b> {cliente.email}
              </p>
            )}
            <p>
              <b>Creada:</b> {new Date(orden.creada).toLocaleString()}
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Equipo</h2>
            <p>
              <b>Aparato:</b> {equipo.aparato}
            </p>
            <p>
              <b>Marca:</b> {equipo.marca}
            </p>
            <p>
              <b>Modelo:</b> {equipo.modelo}
            </p>
            <p>
              <b>Nº de serie:</b> {equipo.numeroSerie}
            </p>
            <p>
              <b>Descripción:</b> {equipo.descripcion}
            </p>
          </div>
        </div>
      </div>

      <PresupuestoSummary orden={orden} onNavigateToBudget={onNavigateToBudget} />

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-2">
            Estado actual: <b>{orden.estado}</b>
          </h2>
          <select
            className="input"
            value={orden.estado}
            onChange={(e) => actualizarEstado(e.target.value)}
          >
            {estados.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-2">Trabajo realizado</h2>
          <textarea
            className="input min-h-32"
            value={trabajoRealizado}
            onChange={(e) => setTrabajoRealizado(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-3">Adjuntos</h2>
          <input
            type="file"
            multiple
            onChange={(e) =>
              setLocalFiles(e.target.files ? Array.from(e.target.files) : null)
            }
          />
          <button className="btn btn-primary mt-2" onClick={subirAdjuntos}>
            Subir
          </button>

          {remoteFiles.length > 0 && (
            <div className="mt-4 grid sm:grid-cols-3 gap-2">
              {remoteFiles.map((f) => (
                <div key={f.name} className="border p-2 rounded">
                  <a
                    href={
                      supa.storage
                        .from("adjuntos")
                        .getPublicUrl(`${ordenId}/${f.name}`).data.publicUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="block text-blue-600 text-sm truncate"
                  >
                    {f.name}
                  </a>
                  <button
                    className="btn btn-sm btn-danger mt-1"
                    onClick={() => borrarAdjunto(f.name)}
                  >
                    Borrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-neutral-800 border p-3 rounded shadow">
          {toast}
          <button className="ml-2 btn btn-sm" onClick={() => setToast(null)}>
            Cerrar
          </button>
        </div>
      )}
    </section>
  );
}
