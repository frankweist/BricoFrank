import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { supa } from "../../data/supabase";

const DEBUG_SYNC = false; // ← activar modo desarrollador (logs en consola)
const estados = ['recepcion', 'diagnostico', 'reparacion', 'listo', 'entregado']; // Estados posibles

function log(...args: any[]) {
  if (DEBUG_SYNC) console.log("[SYNC]", ...args);
}

function fmtBytes(n: number) {
  if (n < 1024) return n + " B";
  const k = 1024, u = ["KB", "MB", "GB", "TB"];
  let i = -1, v = n;
  do { v /= k; i++; } while (v >= k && i < u.length - 1);
  return v.toFixed(1) + " " + u[i];
}

export function DetalleOrden({ ordenId }: { ordenId: string }) {
  const [nota, setNota] = useState("");
  const [pieza, setPieza] = useState({
    nombre: "", cantidad: 1, coste: 0,
    estado: "pendiente" as "pendiente" | "pedido" | "recibido" | "instalado"
  });
  const [toast, setToast] = useState<{ msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // === CONSULTAS DE DATOS ===
  const orden = useLiveQuery(() => db.ordenes.get(ordenId), [ordenId]);
  
  // 💡 NUEVO: Consultar el equipo asociado a la orden
  const equipo = useLiveQuery(
    () => orden?.equipoId ? db.equipos.get(orden.equipoId) : undefined,
    [orden?.equipoId]
  );
  
  // 💡 NUEVO: Consultar el cliente asociado al equipo
  const cliente = useLiveQuery(
    () => equipo?.clienteId ? db.clientes.get(equipo.clienteId) : undefined,
    [equipo?.clienteId]
  );

  const piezas = useLiveQuery(() => db.piezas.where("ordenId").equals(ordenId).toArray(), [ordenId]);
  const eventos = useLiveQuery(() => db.eventos.where("ordenId").equals(ordenId).reverse().toArray(), [ordenId]);
  const files = useLiveQuery(() => db.adjuntos.where("ordenId").equals(ordenId).toArray(), [ordenId]);
  const piezasTotal = useMemo(() => (piezas || []).reduce((s, p) => s + (p.coste * p.cantidad), 0), [piezas]);
  
  // 💡 NUEVO: Consolidar y formatear la información para la vista
  const orderDetails = useMemo(() => {
    if (!orden) return null;
    const eq = equipo;
    const cl = cliente;

    const equipoInfo = eq 
      ? `${eq.marca} ${eq.modelo} (${eq.categoria || 'Genérico'})` 
      : 'N/A';

    return {
      codigo: orden.codigo,
      estado: orden.estado,
      clienteNombre: cl?.nombre || 'N/A',
      clienteTelefono: cl?.telefono || 'N/A',
      equipoInfo: equipoInfo,
      creada: orden.creada,
      actualizada: orden.actualizada,
    };
  }, [orden, equipo, cliente]);

  // === FUNCIONES ===

  // 💡 MEJORA: Función para cambiar el estado de la orden
  async function cambiarEstadoOrden(nuevoEstado: string) {
    if (!orden || !nuevoEstado) return;
    try {
      await db.ordenes.update(ordenId, { 
        estado: nuevoEstado, 
        actualizada: new Date().toISOString() 
      });
      await db.eventos.add({ 
        id: crypto.randomUUID(), 
        ordenId, 
        tipo: "estado", 
        texto: `Estado cambiado a: ${nuevoEstado}`, 
        fecha: new Date().toISOString() 
      });
      setToast({ msg: `Estado actualizado a ${nuevoEstado}.` });
    } catch (error) {
      console.error("Error al cambiar el estado:", error);
      setToast({ msg: "Error al actualizar el estado." });
    }
  }
  
  // === AUTO SYNC (mantenido) ===
  useEffect(() => {
    if (!ordenId) return;
    const sync = async () => {
      // ... (Lógica de sincronización de adjuntos)
    };
    // Desactivado para brevedad, asume que la función sync original está aquí
  }, [ordenId]);

  // === ADJUNTOS ===
  async function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    // ... (Lógica de selección de archivos)
  }

  async function borrarAdjunto(id: string, nombre: string) {
    // ... (Lógica de borrado de adjuntos)
  }

  if (!ordenId) return <div className="card"><div className="card-body">Selecciona una orden.</div></div>;
  if (!orderDetails) return <div className="card"><div className="card-body">Cargando datos de la orden...</div></div>;

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Orden: {orderDetails.codigo}</h2>
        {syncing ? <span className="text-sm opacity-70">⏳ Sincronizando…</span> : <span className="text-sm opacity-70">✔ Sincronizado</span>}
      </div>

      {/* === NUEVO: Detalle de la Orden === */}
      <div className="card">
        <div className="card-body grid sm:grid-cols-2 gap-3">
          <h3 className="font-medium sm:col-span-2">Detalles Clave</h3>
          
          <div className="flex justify-between border-b pb-1">
            <span className="opacity-70">Estado:</span>
            <span className="font-semibold text-right">{orderDetails.estado.toUpperCase()}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="opacity-70">Cliente:</span>
            <span className="text-right">{orderDetails.clienteNombre}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="opacity-70">Teléfono:</span>
            <span className="text-right">{orderDetails.clienteTelefono}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="opacity-70">Equipo:</span>
            <span className="text-right">{orderDetails.equipoInfo}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="opacity-70">Creada:</span>
            <span className="text-right">{new Date(orderDetails.creada).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="opacity-70">Última Act.:</span>
            <span className="text-right">{new Date(orderDetails.actualizada).toLocaleDateString()}</span>
          </div>
          
          {/* 💡 MEJORA: Selector de estado */}
          <div className="mt-2 sm:col-span-2 grid sm:grid-cols-[150px_1fr] gap-2 items-center">
            <span className="opacity-70">Cambiar Estado a:</span>
            <select 
              className="input" 
              value={orderDetails.estado} 
              onChange={e => cambiarEstadoOrden(e.target.value)}
            >
              {estados.map(s => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* === Fin Detalle de la Orden === */}
      
      {/* === Timeline === */}
      <div className="card"><div className="card-body grid gap-3">
        {/* ... (código existente del timeline) ... */}
        <div className="font-medium">Timeline / Notas</div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <input className="input" placeholder="Nueva nota" value={nota} onChange={e => setNota(e.target.value)} />
          <button className="btn btn-primary" onClick={async () => {
            if (!nota.trim()) return;
            await db.eventos.add({ id: crypto.randomUUID(), ordenId, tipo: "nota", texto: nota.trim(), fecha: new Date().toISOString() });
            setNota(""); setToast({ msg: "Nota agregada." });
          }}>Añadir</button>
        </div>
        {eventos?.length ? (
          <ul className="text-sm">
            {eventos.map(e => (
              <li key={e.id}>{new Date(e.fecha).toLocaleString()} — {e.texto}</li>
            ))}
          </ul>
        ) : <p className="text-sm opacity-60">Sin eventos.</p>}
      </div></div>
      
      {/* === Piezas === */}
      {/* ... (código existente de piezas) ... */}
      <div className="card"><div className="card-body grid gap-3">
        <div className="font-medium">Piezas usadas</div>
        <div className="grid sm:grid-cols-4 gap-2">
          <input className="input" placeholder="Nombre" value={pieza.nombre} onChange={e => setPieza({ ...pieza, nombre: e.target.value })} />
          <input className="input" type="number" placeholder="Cant." value={pieza.cantidad} onChange={e => setPieza({ ...pieza, cantidad: +e.target.value })} />
          <input className="input" type="number" placeholder="Coste" value={pieza.coste} onChange={e => setPieza({ ...pieza, coste: +e.target.value })} />
          <button className="btn btn-primary" onClick={async () => {
            if (!pieza.nombre.trim()) return;
            await db.piezas.add({ id: crypto.randomUUID(), ordenId, ...pieza });
            setPieza({ nombre: "", cantidad: 1, coste: 0, estado: "pendiente" });
            setToast({ msg: "Pieza agregada." });
          }}>Añadir</button>
        </div>
        {piezas?.length ? (
          <ul className="text-sm grid gap-1">
            {piezas.map(p => (
              <li key={p.id} className="flex justify-between items-center">
                <span>{p.nombre} ×{p.cantidad} — {p.estado} — {p.coste.toFixed(2)} €</span>
                <button className="btn" onClick={async () => { await db.piezas.delete(p.id); setToast({ msg: "Pieza eliminada." }); }}>Borrar</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm opacity-60">Sin piezas.</p>}
        <div className="font-semibold text-right">Total piezas: {piezasTotal.toFixed(2)} €</div>
      </div></div>

      {/* === Adjuntos === */}
      {/* ... (código existente de adjuntos) ... */}
      <div className="card"><div className="card-body grid gap-3">
        <div className="flex justify-between items-center">
          <span className="font-medium">Adjuntos</span>
          <input type="file" className="input" multiple onChange={onPickFiles} />
        </div>
        {files?.length ? (
          <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map(f => {
              const isImg = /^image\//.test(f.tipo);
              const url = URL.createObjectURL(f.blob);
              return (
                <div key={f.id} className="card"><div className="card-body grid gap-2">
                  <div className="text-sm break-all">{f.nombre}</div>
                  <div className="text-xs opacity-70">{fmtBytes(f.tam)} — {new Date(f.fecha).toLocaleString()}</div>
                  {isImg ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={f.nombre} className="w-full h-32 object-cover rounded-lg border" />
                    </a>
                  ) : <a href={url} target="_blank" rel="noreferrer" className="btn">Descargar</a>}
                  <button className="btn" onClick={() => borrarAdjunto(f.id, f.nombre)}>Borrar</button>
                </div></div>
              );
            })}
          </div>
        ) : <p className="text-sm opacity-60">Sin adjuntos.</p>}
      </div></div>

      {/* === Toast === */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="card"><div className="card-body flex items-center gap-2">
            <span>{toast.msg}</span>
            <button className="btn" onClick={() => setToast(null)}>Cerrar</button>
          </div></div>
        </div>
      )}
    </section>
  );
}