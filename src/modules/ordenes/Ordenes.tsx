import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { ChevronDown, ChevronRight, Download, Upload } from "lucide-react";
import { forceSync } from "../../sync/autosync";

type OrdenRow = {
  id: string;
  codigo: string;
  estado: string;
  cliente: string;
  telefono: string;
  equipo?: string;
  aparato?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  descripcion?: string;
  creada: string;
  actualizada: string;
};

type GrupoCliente = {
  clienteKey: string;
  nombre: string;
  telefono: string;
  totalOrdenes: number;
  ordenes: OrdenRow[];
};

function download(data: string, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function pickJSON(): Promise<any | null> {
  return new Promise((res) => {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = "application/json";
    i.onchange = async () => {
      const f = i.files?.[0];
      if (!f) return res(null);
      try {
        const data = JSON.parse(await f.text());
        res(data);
      } catch {
        res(null);
      }
    };
    i.click();
  });
}

export function Ordenes({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<
    | "todos"
    | "recepcion"
    | "diagnostico"
    | "presupuesto"
    | "reparacion"
    | "listo"
    | "entregado"
  >("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<OrdenRow & { estado: string }>>({});

  // Leer órdenes desde db.ordenes, sin guiones por defecto
  const allOrdenes = useLiveQuery(async () => {
    const ordenes = await db.ordenes.toArray();
    return ordenes.map((o: any) => ({
      id: o.id,
      codigo: o.codigo ?? "",
      estado: o.estado ?? "",
      cliente: o.cliente ?? "",
      telefono: o.telefono ?? "",
      equipo: o.equipo ?? "",
      aparato: o.aparato ?? "",
      marca: o.marca ?? "",
      modelo: o.modelo ?? "",
      numeroSerie: o.numeroSerie ?? "",
      descripcion: o.descripcion ?? "",
      creada: o.creada,
      actualizada: o.actualizada,
    })) as OrdenRow[];
  }, []);

  // Agrupar por cliente y ordenar por orden de llegada (creada asc)
  const grupos = useMemo<GrupoCliente[]>(() => {
    if (!allOrdenes) return [];
    const gruposMap: Record<string, GrupoCliente> = {};

    allOrdenes.forEach((o) => {
      const key = `${o.cliente}-${o.telefono}`;
      if (!gruposMap[key]) {
        gruposMap[key] = {
          clienteKey: key,
          nombre: o.cliente,
          telefono: o.telefono,
          totalOrdenes: 0,
          ordenes: [],
        };
      }
      gruposMap[key].ordenes.push(o);
      gruposMap[key].totalOrdenes++;
    });

    const t = q.trim().toLowerCase();

    const gruposArray = Object.values(gruposMap)
      .map((g) => {
        const ordenesFiltradas = g.ordenes
          .filter((r) => {
            const matchesEstado = estado === "todos" || r.estado === estado;
            const matchesDesde =
              !desde ||
              new Date(r.creada).getTime() >= new Date(desde).getTime();
            const matchesHasta =
              !hasta ||
              new Date(r.creada).getTime() <
                new Date(hasta).getTime() + 86400000;
            const aparatoBuscado = (r.aparato || r.equipo || "").toLowerCase();
            const matchesQuery =
              !t ||
              (r.cliente || "").toLowerCase().includes(t) ||
              (r.telefono || "").includes(t) ||
              aparatoBuscado.includes(t) ||
              (r.codigo || "").toLowerCase().includes(t);
            return (
              matchesEstado && matchesDesde && matchesHasta && matchesQuery
            );
          })
          // Orden de llegada dentro de cada cliente
          .sort(
            (a, b) =>
              new Date(a.creada).getTime() - new Date(b.creada).getTime()
          );

        return {
          ...g,
          ordenes: ordenesFiltradas,
          totalOrdenes: ordenesFiltradas.length,
        };
      })
      .filter((g) => g.totalOrdenes > 0);

    // Orden de llegada entre clientes: por la primera orden de cada grupo
    gruposArray.sort((a, b) => {
      const fa = a.ordenes.length
        ? new Date(a.ordenes[0].creada).getTime()
        : Number.MAX_SAFE_INTEGER;
      const fb = b.ordenes.length
        ? new Date(b.ordenes[0].creada).getTime()
        : Number.MAX_SAFE_INTEGER;
      return fa - fb;
    });

    return gruposArray;
  }, [allOrdenes, q, estado, desde, hasta]);

  async function eliminarOrden(id: string) {
    if (!window.confirm("¿Eliminar esta orden definitivamente?")) return;
    await db.ordenes.delete(id);
  }

  async function exportarDatos() {
    if (!allOrdenes) return;
    const data = JSON.stringify(allOrdenes, null, 2);
    download(
      data,
      `ordenes_backup_${new Date().toISOString().split("T")[0]}.json`,
      "application/json"
    );
  }

  async function importarDatos() {
    if (!window.confirm("⚠️ Esto reemplazará todas las órdenes locales. ¿Continuar?"))
      return;
    const data = await pickJSON();
    if (!Array.isArray(data)) return alert("Archivo no válido.");
    await db.transaction("rw", db.ordenes, async () => {
      await db.ordenes.clear();
      await db.ordenes.bulkAdd(data);
    });
    alert("✅ Importación completada. Recarga la página.");
    window.location.reload();
  }

  async function sincronizarManualmente() {
    setIsSyncing(true);
    await forceSync();
    setIsSyncing(false);
  }

  function empezarEdicion(r: OrdenRow) {
    setEditando(r.id);
    setForm({
      cliente: r.cliente,
      telefono: r.telefono,
      aparato: r.aparato,
      marca: r.marca,
      modelo: r.modelo,
      numeroSerie: r.numeroSerie,
      descripcion: r.descripcion,
      estado: r.estado,
    });
  }

  function cancelarEdicion() {
    setEditando(null);
    setForm({});
  }

  async function guardarCambios(id: string) {
    await db.ordenes.update(id, {
      cliente: form.cliente ?? "",
      telefono: form.telefono ?? "",
      aparato: form.aparato ?? "",
      marca: form.marca ?? "",
      modelo: form.modelo ?? "",
      numeroSerie: form.numeroSerie ?? "",
      descripcion: form.descripcion ?? "",
      estado: form.estado ?? "",
      actualizada: new Date().toISOString(),
    });
    alert("✅ Cambios guardados");
    cancelarEdicion();
  }

  return (
    <section className="grid gap-4">
      <div className="card">
        <div className="card-body grid gap-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <label className="sm:col-span-2">
              <span className="text-sm text-neutral-500">
                Buscar (Cliente, Teléfono, Aparato)
              </span>
              <input
                className="input w-full"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Escribe para filtrar..."
              />
            </label>
            <label>
              <span className="text-sm text-neutral-500">Estado</span>
              <select
                className="input w-full"
                value={estado}
                onChange={(e) => setEstado(e.target.value as any)}
              >
                <option value="todos">Todos</option>
                <option value="recepcion">Recepción</option>
                <option value="diagnostico">Diagnóstico</option>
                <option value="presupuesto">Presupuesto</option>
                <option value="reparacion">Reparación</option>
                <option value="listo">Listo</option>
                <option value="entregado">Entregado</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button className="btn" onClick={exportarDatos}>
              <Download className="size-4 mr-1" /> Exportar JSON
            </button>
            <button className="btn" onClick={importarDatos}>
              <Upload className="size-4 mr-1" /> Importar JSON
            </button>
            <button
              className="btn btn-secondary"
              onClick={sincronizarManualmente}
              disabled={isSyncing}
            >
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              <th className="p-2 text-left w-10"></th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Teléfono</th>
              <th className="p-2 text-left">Órdenes</th>
              <th className="p-2 text-left">Última Act.</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <React.Fragment key={g.clienteKey}>
                <tr
                  className="bg-neutral-50 dark:bg-neutral-700 font-semibold cursor-pointer border-y hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  onClick={() =>
                    setExpandedCliente(
                      expandedCliente === g.clienteKey ? null : g.clienteKey
                    )
                  }
                >
                  <td className="py-2 px-3">
                    {expandedCliente === g.clienteKey ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </td>
                  <td className="py-2 pr-3">{g.nombre || "Sin nombre"}</td>
                  <td className="py-2 pr-3">{g.telefono}</td>
                  <td className="py-2 pr-3">{g.totalOrdenes} órdenes</td>
                  <td className="py-2 pr-3">
                    {new Date(g.ordenes[0].actualizada).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3"></td>
                </tr>

                {expandedCliente === g.clienteKey && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-500 border-b">
                            <th className="py-2 pl-8 text-left">Código</th>
                            <th className="py-2 text-left">Equipo</th>
                            <th className="py-2 text-left">Estado</th>
                            <th className="py-2 text-left">Actualizada</th>
                            <th className="py-2 text-left w-48">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.ordenes.map((r) => (
                            <React.Fragment key={r.id}>
                              <tr className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-700">
                                <td className="py-2 pl-8">{r.codigo}</td>
                                <td className="py-2">
                                  {r.aparato || r.equipo || "Sin equipo"}
                                  <div className="text-xs text-neutral-500">
                                    {r.marca && (
                                      <div>
                                        <b>Marca:</b> {r.marca}
                                      </div>
                                    )}
                                    {r.modelo && (
                                      <div>
                                        <b>Modelo:</b> {r.modelo}
                                      </div>
                                    )}
                                    {r.numeroSerie && (
                                      <div>
                                        <b>Serie:</b> {r.numeroSerie}
                                      </div>
                                    )}
                                    {r.descripcion && (
                                      <div>
                                        <b>Descripción:</b> {r.descripcion}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2">{r.estado}</td>
                                <td className="py-2">
                                  {new Date(r.actualizada).toLocaleString()}
                                </td>
                                <td className="py-2 flex gap-2">
                                  <button
                                    className="btn btn-primary"
                                    onClick={() => onOpen(r.id)}
                                  >
                                    Abrir
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() => empezarEdicion(r)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    onClick={() => eliminarOrden(r.id)}
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              </tr>

                              {editando === r.id && (
                                <tr className="bg-neutral-100 dark:bg-neutral-800 border-t">
                                  <td colSpan={5} className="p-4">
                                    <div className="grid sm:grid-cols-2 gap-2">
                                      <input
                                        className="input w-full"
                                        placeholder="Cliente"
                                        value={form.cliente ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            cliente: e.target.value,
                                          }))
                                        }
                                      />
                                      <input
                                        className="input w-full"
                                        placeholder="Teléfono"
                                        value={form.telefono ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            telefono: e.target.value,
                                          }))
                                        }
                                      />
                                      <input
                                        className="input w-full"
                                        placeholder="Aparato"
                                        value={form.aparato ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            aparato: e.target.value,
                                          }))
                                        }
                                      />
                                      <input
                                        className="input w-full"
                                        placeholder="Marca"
                                        value={form.marca ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            marca: e.target.value,
                                          }))
                                        }
                                      />
                                      <input
                                        className="input w-full"
                                        placeholder="Modelo"
                                        value={form.modelo ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            modelo: e.target.value,
                                          }))
                                        }
                                      />
                                      <input
                                        className="input w-full"
                                        placeholder="Número de serie"
                                        value={form.numeroSerie ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            numeroSerie: e.target.value,
                                          }))
                                        }
                                      />
                                      <textarea
                                        className="input w-full"
                                        placeholder="Descripción"
                                        value={form.descripcion ?? ""}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            descripcion: e.target.value,
                                          }))
                                        }
                                      />
                                      <select
                                        className="input w-full"
                                        value={form.estado ?? r.estado}
                                        onChange={(e) =>
                                          setForm((prev) => ({
                                            ...prev,
                                            estado: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="recepcion">
                                          Recepción
                                        </option>
                                        <option value="diagnostico">
                                          Diagnóstico
                                        </option>
                                        <option value="presupuesto">
                                          Presupuesto
                                        </option>
                                        <option value="reparacion">
                                          Reparación
                                        </option>
                                        <option value="listo">Listo</option>
                                        <option value="entregado">
                                          Entregado
                                        </option>
                                      </select>
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        className="btn btn-primary"
                                        onClick={() => guardarCambios(r.id)}
                                      >
                                        Guardar cambios
                                      </button>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={cancelarEdicion}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
