import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { supa } from "../../data/supabase";

const DEBUG_SYNC = false; // ← activar modo desarrollador (logs en consola)

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

  const orden = useLiveQuery(() => db.ordenes.get(ordenId), [ordenId]);
  const piezas = useLiveQuery(() => db.piezas.where("ordenId").equals(ordenId).toArray(), [ordenId]);
  const eventos = useLiveQuery(() => db.eventos.where("ordenId").equals(ordenId).reverse().toArray(), [ordenId]);
  const files = useLiveQuery(() => db.adjuntos.where("ordenId").equals(ordenId).toArray(), [ordenId]);
  const piezasTotal = useMemo(() => (piezas || []).reduce((s, p) => s + (p.coste * p.cantidad), 0), [piezas]);

  // === AUTO SYNC ===
  useEffect(() => {
    if (!ordenId) return;
    const sync = async () => {
      try {
        setSyncing(true);
        // 1️⃣ Subir adjuntos nuevos a Supabase
        const local = await db.adjuntos.where("ordenId").equals(ordenId).toArray();
        for (const f of local) {
          const path = `adjuntos/${ordenId}/${f.nombre}`;
          const { data: exists } = await supa.storage.from("adjuntos").list(`adjuntos/${ordenId}`);
          if (!exists?.some((x) => x.name === f.nombre)) {
            const { error } = await supa.storage.from("adjuntos").upload(path, f.blob, { upsert: true });
            if (error) log("upload error", error.message); else log("uploaded", path);
          }
        }
        // 2️⃣ Descargar adjuntos de Supabase que no estén en Dexie
        const { data: remote, error } = await supa.storage.from("adjuntos").list(`adjuntos/${ordenId}`);
        if (error) log("list error", error.message);
        if (remote) {
          for (const r of remote) {
            const exists = local.some((f) => f.nombre === r.name);
            if (!exists) {
              const { data: dl } = await supa.storage.from("adjuntos").download(`adjuntos/${ordenId}/${r.name}`);
              if (dl) {
                const blob = dl as Blob;
                await db.adjuntos.add({
                  id: crypto.randomUUID(),
                  ordenId,
                  nombre: r.name,
                  tipo: blob.type || "application/octet-stream",
                  tam: blob.size,
                  fecha: new Date().toISOString(),
                  blob
                });
                log("descargado", r.name);
              }
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Sync error", err);
      } finally {
        setSyncing(false);
      }
    };
    sync();
  }, [ordenId]);

  // === ADJUNTOS ===
  async function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const fl = ev.target.files;
    if (!fl || !fl.length) return;
    for (const f of Array.from(fl)) {
      const id = crypto.randomUUID();
      const arrBuf = await f.arrayBuffer();
      const blob = new Blob([arrBuf], { type: f.type || "application/octet-stream" });
      await db.adjuntos.add({
        id, ordenId, nombre: f.name, tipo: f.type || "application/octet-stream",
        tam: f.size, fecha: new Date().toISOString(), blob
      });
    }
    setToast({ msg: "Adjunto(s) agregado(s)." });
    ev.target.value = "";
  }

  async function borrarAdjunto(id: string, nombre: string) {
    await db.adjuntos.delete(id);
    await supa.storage.from("adjuntos").remove([`adjuntos/${ordenId}/${nombre}`]);
    setToast({ msg: "Adjunto eliminado." });
  }

  if (!ordenId) return <div className="card"><div className="card-body">Selecciona una orden.</div></div>;

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Orden: {orden?.codigo || "..."}</h2>
        {syncing ? <span className="text-sm opacity-70">⏳ Sincronizando…</span> : <span className="text-sm opacity-70">✔ Sincronizado</span>}
      </div>

      {/* === Timeline === */}
      <div className="card"><div className="card-body grid gap-3">
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
