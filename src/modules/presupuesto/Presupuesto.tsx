import { useEffect, useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";

type Pieza = { nombre: string; precio: number };

type ClienteData =
  | { nombre: string; telefono?: string; email?: string }
  | string
  | undefined;

type EquipoData =
  | {
      aparato?: string;
      marca?: string;
      modelo?: string;
      numeroSerie?: string;
      descripcion?: string;
    }
  | string
  | undefined;

type Orden = {
  id: string;
  codigo?: string;
  codigo_orden?: string;
  estado?: string;
  creada?: string; // ISO
  fecha_creacion?: string; // compat
  presupuestoAprox?: number | null;
  horasReparacion?: number;
  tarifa?: number;
  piezas?: Pieza[];
  cliente?: ClienteData;
  telefono?: string; // compat cuando cliente sea string
  equipo?: EquipoData;
  equipoId?: string;
};

function getClienteNombre(c: ClienteData, telefono?: string) {
  if (!c) return "—";
  if (typeof c === "string") return `${c}${telefono ? ` (${telefono})` : ""}`;
  return c.nombre || "—";
}

function getEquipoTexto(e: EquipoData) {
  if (!e) return "—";
  if (typeof e === "string") return e || "—";
  const partes = [
    e.aparato || "",
    e.marca || "",
    e.modelo || "",
    e.numeroSerie ? `SN:${e.numeroSerie}` : "",
  ].filter(Boolean);
  return partes.join(" ").trim() || "—";
}

function parseFecha(o: Orden): number {
  const f = o.creada || o.fecha_creacion;
  return f ? new Date(f).getTime() : 0;
}

export function Presupuesto({ ordenId }: { ordenId?: string }) {
  // ======= Estado de selección =======
  const [seleccionadaId, setSeleccionadaId] = useState<string | undefined>(
    ordenId
  );
  useEffect(() => {
    setSeleccionadaId(ordenId);
  }, [ordenId]);

  // ======= Listado de órdenes (todas) + búsqueda =======
  const todas = useLiveQuery(async () => {
    const arr = await db.ordenes.toArray();
    // Orden de llegada: asc por fecha de creación
    return arr.sort((a, b) => parseFecha(a as any) - parseFecha(b as any)) as Orden[];
  }, []) as Orden[] | undefined;

  const [q, setQ] = useState("");
  const filtradas = useMemo(() => {
    if (!todas) return [];
    const term = q.trim().toLowerCase();
    if (!term) return todas;
    return todas.filter((o) => {
      const codigo = (o.codigo || o.codigo_orden || "").toLowerCase();
      const cliente = getClienteNombre(o.cliente, o.telefono).toLowerCase();
      const equipo = getEquipoTexto(o.equipo).toLowerCase();
      return (
        codigo.includes(term) ||
        cliente.includes(term) ||
        equipo.includes(term)
      );
    });
  }, [todas, q]);

  // ======= Carga de la orden activa =======
  const orden = useLiveQuery(
    () =>
      seleccionadaId
        ? (db.ordenes.get(seleccionadaId) as Promise<Orden | undefined>)
        : Promise.resolve(undefined),
    [seleccionadaId]
  );

  // ======= Estado editable =======
  const [cliente, setCliente] = useState<any>(null);
  const [equipo, setEquipo] = useState<any>(null);
  const [piezas, setPiezas] = useState<Pieza[]>([{ nombre: "", precio: 0 }]);
  const [horas, setHoras] = useState<number>(0);
  const [tarifa, setTarifa] = useState<number>(25);
  const [precioNuevo, setPrecioNuevo] = useState<number | "">("");
  const [precioSegundaMano, setPrecioSegundaMano] = useState<number | "">("");
  const [presupuesto, setPresupuesto] = useState<number | null>(null);

  // Cargar datos de la orden seleccionada
  useEffect(() => {
    if (!orden) return;

    // cliente
    if (typeof orden.cliente === "object") setCliente(orden.cliente);
    else
      setCliente({
        nombre:
          (typeof orden.cliente === "string" && orden.cliente) ||
          "—",
        telefono: orden.telefono || "—",
      });

    // equipo
    if (typeof orden.equipo === "object") setEquipo(orden.equipo);
    else setEquipo({ aparato: orden.equipo || "—" });

    // otros campos
    setPiezas(orden.piezas?.length ? (orden.piezas as Pieza[]) : [{ nombre: "", precio: 0 }]);
    setTarifa(orden.tarifa || 25);
    setHoras(orden.horasReparacion || 0);
    // En tu schema anterior estos campos no estaban persistidos siempre; mantenemos compat
    // Si existen en orden, preferir; si no, mantener último estado
    // Para precios de referencia se usan claves locales en esta vista
    setPrecioNuevo((orden as any).precioNuevo ?? "");
    setPrecioSegundaMano((orden as any).precioSegundaMano ?? "");
    setPresupuesto(orden.presupuestoAprox ?? null);
  }, [orden]);

  // ======= Guardado automático con debounce =======
  const guardar = useCallback(
    async (patch?: Partial<Orden> & Record<string, any>) => {
      if (!seleccionadaId) return;
      await db.ordenes.update(seleccionadaId, {
        piezas,
        horasReparacion: horas,
        tarifa,
        precioNuevo: precioNuevo === "" ? null : Number(precioNuevo),
        precioSegundaMano:
          precioSegundaMano === "" ? null : Number(precioSegundaMano),
        presupuestoAprox: presupuesto,
        actualizada: new Date().toISOString(),
        ...(patch || {}),
      });
    },
    [seleccionadaId, piezas, horas, tarifa, precioNuevo, precioSegundaMano, presupuesto]
  );

  useEffect(() => {
    if (!orden) return;
    const t = setTimeout(() => guardar(), 600);
    return () => clearTimeout(t);
  }, [piezas, horas, tarifa, precioNuevo, precioSegundaMano, presupuesto, orden, guardar]);

  // ======= Cálculo =======
  const calcular = () => {
    const subtotal =
      horas * tarifa + piezas.reduce((s, p) => s + (p.precio || 0), 0) * 1.15;
    const total =
      precioSegundaMano && subtotal > Number(precioSegundaMano) * 0.8
        ? Number(precioSegundaMano) * 0.8
        : subtotal;
    setPresupuesto(Math.round(total * 100) / 100);
  };

  // ======= Render =======
  // Vista listado cuando no hay orden seleccionada
  if (!seleccionadaId) {
    return (
      <section className="grid gap-4">
        <div className="card">
          <div className="card-body grid gap-3">
            <h2 className="text-lg font-semibold">Órdenes (todas)</h2>

            <input
              className="input"
              placeholder="Buscar por código, cliente o equipo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            {!todas && (
              <p className="text-sm opacity-70">Cargando órdenes…</p>
            )}

            {todas && filtradas.length === 0 && (
              <p className="text-sm opacity-70">Sin resultados.</p>
            )}

            {todas && filtradas.length > 0 && (
              <div className="grid gap-2">
                {filtradas.map((o) => (
                  <button
                    key={o.id}
                    className="text-left border p-2 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    onClick={() => setSeleccionadaId(o.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">
                        {o.codigo || o.codigo_orden || o.id.slice(0, 8)}
                      </div>
                      <div className="text-xs opacity-70">
                        {new Date(parseFecha(o)).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="opacity-70">Cliente:</span>{" "}
                      {getClienteNombre(o.cliente, o.telefono)}
                    </div>
                    <div className="text-sm">
                      <span className="opacity-70">Equipo:</span>{" "}
                      {getEquipoTexto(o.equipo)}
                    </div>
                    {o.estado && (
                      <div className="text-xs mt-1">
                        <span className="opacity-70">Estado:</span> {o.estado}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Vista de edición cuando hay orden seleccionada
  if (!orden)
    return (
      <p className="text-sm opacity-70">
        Cargando datos de la orden ({seleccionadaId})...
      </p>
    );

  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => setSeleccionadaId(undefined)}>
          ← Volver a la lista
        </button>
        <div className="text-sm opacity-70">
          {(orden.codigo || orden.codigo_orden || orden.id.slice(0, 8)) +
            " · " +
            (orden.estado || "—")}
        </div>
      </div>

      <div className="card">
        <div className="card-body grid sm:grid-cols-2 gap-4">
          <div>
            <h2 className="font-semibold">Cliente</h2>
            <p>{cliente?.nombre || "—"}</p>
            <p>{cliente?.telefono || "—"}</p>
            {"email" in (cliente || {}) && cliente?.email && <p>{cliente.email}</p>}
          </div>
          <div>
            <h2 className="font-semibold">Equipo</h2>
            <p>
              {(equipo?.aparato || equipo?.categoria || equipo || "—") +
                " " +
                (equipo?.marca || "") +
                " " +
                (equipo?.modelo || "")}
            </p>
            <p>{equipo?.descripcion || "—"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              Tarifa €/h
              <input
                type="number"
                className="input"
                value={tarifa}
                onChange={(e) => setTarifa(Number(e.target.value) || 0)}
              />
            </label>
            <label>
              Horas
              <input
                type="number"
                step="0.5"
                className="input"
                value={horas || ""}
                onChange={(e) => setHoras(Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              Precio nuevo (€)
              <input
                type="number"
                className="input"
                value={precioNuevo}
                onChange={(e) => setPrecioNuevo(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <label>
              Precio segunda mano (€)
              <input
                type="number"
                className="input"
                value={precioSegundaMano}
                onChange={(e) =>
                  setPrecioSegundaMano(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              />
            </label>
          </div>

          <h3 className="font-semibold mt-3">Piezas</h3>
          {piezas.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-[2fr_1fr_auto] gap-2">
              <input
                className="input"
                placeholder="Nombre"
                value={p.nombre}
                onChange={(e) =>
                  setPiezas((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, nombre: e.target.value } : x
                    )
                  )
                }
              />
              <input
                type="number"
                className="input"
                placeholder="Precio"
                value={p.precio || ""}
                onChange={(e) =>
                  setPiezas((prev) =>
                    prev.map((x, j) =>
                      j === i
                        ? { ...x, precio: Number(e.target.value) || 0 }
                        : x
                    )
                  )
                }
              />
              <button
                className="btn"
                onClick={() =>
                  setPiezas((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            className="btn mt-2"
            onClick={() =>
              setPiezas((prev) => [...prev, { nombre: "", precio: 0 }])
            }
          >
            Añadir pieza
          </button>

          <button className="btn btn-primary mt-4" onClick={calcular}>
            Calcular
          </button>

          {presupuesto !== null && (
            <div className="text-lg font-bold mt-2">
              Total: {presupuesto.toFixed(2)} €
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
