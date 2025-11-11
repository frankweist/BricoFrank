import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../data/db";
import { v4 as uuid } from "uuid";
import { useState, useMemo } from "react";
import { buscarSustitutos } from "../../api/mouser";
import { ImportadorDoc } from "./ImportadorDoc";
import { Identificador } from "./Identificador";

/* -------------------- Tipos -------------------- */
type Componente = {
  id: string;
  tipo: string;
  nombre: string;      // valor / referencia (ej: "10k 1/4W", "BC547", "100n 50V")
  cantidad: number;
  ubicacion?: string;
  notas?: string;
  fecha_alta: string;
};

type Equivalencia = {
  id: string;
  origen: string;
  sustituto: string;
  notas?: string;
  fecha: string;
};

type ResultadoMouser = {
  name: string;
  mpn: string;
  manufacturer: string;
  description: string;
  productUrl: string;
};

/* -------------------- Constantes -------------------- */
const TIPOS = [
  "Resistencias",
  "Condensadores",
  "Diodos",
  "Transistores",
  "Fusibles",
  "Relés",
  "Conectores",
  "Cables",
  "IC / Chips",
  "Reguladores",
  "Otros",
];

/* -------------------- Helpers de valores (10k, 100n...) -------------------- */

function suffixToMultiplier(s: string): number {
  switch (s) {
    case "k":
      return 1e3;
    case "m":
      return 1e-3;
    case "u":
    case "µ":
      return 1e-6;
    case "n":
      return 1e-9;
    case "p":
      return 1e-12;
    default:
      return 1;
  }
}

function parseValueFromToken(raw: string): number | null {
  if (!raw) return null;
  let s = raw.toLowerCase().replace(",", ".").trim();
  if (/^\d+r\d+$/i.test(s)) s = s.replace("r", ".");
  const compact = s.match(/^(\d+)([kmunp])(\d+)$/);
  if (compact) {
    const [, intPart, suf, decPart] = compact;
    const base = parseFloat(intPart + "." + decPart);
    const mult = suffixToMultiplier(suf);
    return base * mult;
  }
  const simple = s.match(/^(\d+(\.\d+)?)([kmunp])?$/);
  if (simple) {
    const [, numStr, , suf] = simple;
    const num = parseFloat(numStr);
    const mult = suffixToMultiplier(suf ?? "");
    return num * mult;
  }
  const asNumber = Number(s);
  return Number.isNaN(asNumber) ? null : asNumber;
}

function parseValue(text: string): number | null {
  if (!text) return null;
  const tokens = text.split(/[\s\/,_-]+/);
  for (const t of tokens) {
    const v = parseValueFromToken(t);
    if (v !== null) return v;
  }
  return null;
}

function matchesByValue(nombre: string, query: string): boolean {
  const qVal = parseValue(query);
  if (qVal === null) return false;
  const nVal = parseValue(nombre);
  if (nVal === null) return false;
  const diff = Math.abs(nVal - qVal);
  const tol = Math.max(qVal * 0.05, 1e-12);
  return diff <= tol;
}

/* -------------------- Deducción de tipo desde texto Mouser -------------------- */

function deducirTipoDesdeTexto(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("resistor") || t.includes("resistencia") || t.includes("ohm"))
    return "Resistencias";
  if (t.includes("capacitor") || t.includes("condensador") || t.includes("uf") || t.includes("nf") || t.includes("pf"))
    return "Condensadores";
  if (t.includes("diode") || t.includes("rectifier"))
    return "Diodos";
  if (t.includes("transistor") || t.includes("bjt") || t.includes("fet") || t.includes("mosfet"))
    return "Transistores";
  if (t.includes("fuse"))
    return "Fusibles";
  if (t.includes("relay"))
    return "Relés";
  if (t.includes("connector") || t.includes("header") || t.includes("terminal"))
    return "Conectores";
  if (t.includes("regulator") || t.includes("ldo") || t.includes("dc-dc"))
    return "Reguladores";
  if (t.includes("ic ") || t.includes("integrated circuit"))
    return "IC / Chips";
  return "Otros";
}

/* -------------------- Componente principal -------------------- */

export function Componentes() {
  // búsqueda local
  const [q, setQ] = useState("");

  // alta de componente
  const [tipo, setTipo] = useState("Resistencias");
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");

  // equivalencias locales
  const [origenEq, setOrigenEq] = useState("");
  const [sustitutoEq, setSustitutoEq] = useState("");
  const [notasEq, setNotasEq] = useState("");

  // edición de componentes
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCantidad, setEditCantidad] = useState<number>(1);
  const [editUbicacion, setEditUbicacion] = useState("");
  const [editNotas, setEditNotas] = useState("");

  // búsqueda Mouser
  const [qMouser, setQMouser] = useState("");
  const [resultAPI, setResultAPI] = useState<ResultadoMouser[]>([]);
  const [buscandoAPI, setBuscandoAPI] = useState(false);

  const componentes = useLiveQuery(async () => await db.componentes.toArray(), []);
  const equivalencias = useLiveQuery(
    async () => await db.equivalencias?.toArray?.() ?? [],
    []
  ) as Equivalencia[] | undefined;

  /* ---------- Filtrado local ---------- */

  const filtrados = useMemo(() => {
    if (!componentes) return [];
    const texto = q.trim().toLowerCase();
    if (!texto) return componentes.slice().sort((a, b) => a.tipo.localeCompare(b.tipo));

    return componentes
      .filter((c) => {
        const byText =
          c.nombre.toLowerCase().includes(texto) ||
          c.tipo.toLowerCase().includes(texto) ||
          (c.ubicacion ?? "").toLowerCase().includes(texto) ||
          (c.notas ?? "").toLowerCase().includes(texto);
        const byValue = matchesByValue(c.nombre, texto);
        return byText || byValue;
      })
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [componentes, q]);

  const grupos = useMemo(() => {
    const map: Record<string, Componente[]> = {};
    filtrados.forEach((c) => {
      if (!map[c.tipo]) map[c.tipo] = [];
      map[c.tipo].push(c);
    });
    return Object.entries(map);
  }, [filtrados]);

  /* ---------- Alta de componente ---------- */

  async function agregarComponente() {
    if (!nombre.trim()) {
      alert("Introduce un nombre / valor");
      return;
    }
    if (!cantidad || cantidad <= 0) {
      alert("Cantidad debe ser > 0");
      return;
    }
    const nuevo: Componente = {
      id: uuid(),
      tipo,
      nombre,
      cantidad,
      ubicacion,
      notas,
      fecha_alta: new Date().toISOString(),
    };
    await db.componentes.add(nuevo);
    setNombre("");
    setCantidad(1);
    setUbicacion("");
    setNotas("");
  }

  /* ---------- Edición / borrado ---------- */

  function iniciarEdicion(c: Componente) {
    setEditId(c.id);
    setEditNombre(c.nombre);
    setEditCantidad(c.cantidad);
    setEditUbicacion(c.ubicacion ?? "");
    setEditNotas(c.notas ?? "");
  }

  async function guardarEdicion() {
    if (!editId) return;
    if (!editNombre.trim()) {
      alert("El nombre no puede estar vacío");
      return;
    }
    await db.componentes.update(editId, {
      nombre: editNombre,
      cantidad: editCantidad,
      ubicacion: editUbicacion,
      notas: editNotas,
    });
    setEditId(null);
  }

  async function borrarComponente(id: string) {
    if (!confirm("¿Eliminar este componente del inventario?")) return;
    await db.componentes.delete(id);
    if (editId === id) setEditId(null);
  }

  /* ---------- Equivalencias locales ---------- */

  async function agregarEquivalencia() {
    if (!origenEq.trim() || !sustitutoEq.trim()) {
      alert("Rellena origen y sustituto");
      return;
    }
    const nueva: Equivalencia = {
      id: uuid(),
      origen: origenEq,
      sustituto: sustitutoEq,
      notas: notasEq,
      fecha: new Date().toISOString(),
    };
    await db.equivalencias.add(nueva as any);
    setOrigenEq("");
    setSustitutoEq("");
    setNotasEq("");
  }

  /* ---------- Búsqueda en Mouser ---------- */

  async function buscarEnMouser() {
    if (!qMouser.trim()) return;
    setBuscandoAPI(true);
    setResultAPI([]);
    try {
      const data = await buscarSustitutos(qMouser);
      setResultAPI(data);
    } catch (err) {
      alert("Error al consultar Mouser: " + (err as Error).message);
    } finally {
      setBuscandoAPI(false);
    }
  }

  async function añadirDesdeMouser(r: ResultadoMouser) {
    const tipoDeducido = deducirTipoDesdeTexto(r.description || r.name);
    const nuevo: Componente = {
      id: uuid(),
      tipo: tipoDeducido,
      nombre: r.name,
      cantidad: 1,
      ubicacion: "",
      notas: `${r.manufacturer} / ${r.mpn} - ${r.description}`,
      fecha_alta: new Date().toISOString(),
    };
    await db.componentes.add(nuevo);
    alert("Componente añadido al inventario.");
  }

  /* ---------- Render ---------- */

  return (
    <section className="grid gap-4">
	   {/* IDENTIFICADOR DE COMPONENTES */}
      <Identificador />
      {/* BUSCAR EN INVENTARIO */}
      <div className="card p-4 grid gap-3">
        <h2 className="text-xl font-semibold">Buscar en inventario</h2>
        <input
          className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          placeholder="Buscar por nombre, tipo, valor (10k, 100n...), ubicación o notas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* LISTADO CON EDICIÓN */}
      {grupos.map(([grupoTipo, items]) => (
        <div key={grupoTipo} className="card p-4">
          <h3 className="font-semibold mb-2">{grupoTipo}</h3>
          <table className="w-full text-sm border-t">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="p-2 text-left">Nombre / valor</th>
                <th className="p-2 text-left">Cantidad</th>
                <th className="p-2 text-left">Ubicación</th>
                <th className="p-2 text-left">Notas</th>
                <th className="p-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const enEdicion = editId === c.id;
                return (
                  <tr
                    key={c.id}
                    className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-700"
                  >
                    <td className="p-2">
                      {enEdicion ? (
                        <input
                          className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                        />
                      ) : (
                        c.nombre
                      )}
                    </td>
                    <td className="p-2 w-20">
                      {enEdicion ? (
                        <input
                          type="number"
                          min={0}
                          className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                          value={editCantidad}
                          onChange={(e) =>
                            setEditCantidad(parseInt(e.target.value) || 0)
                          }
                        />
                      ) : (
                        c.cantidad
                      )}
                    </td>
                    <td className="p-2 w-32">
                      {enEdicion ? (
                        <input
                          className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                          value={editUbicacion}
                          onChange={(e) => setEditUbicacion(e.target.value)}
                        />
                      ) : (
                        c.ubicacion || "-"
                      )}
                    </td>
                    <td className="p-2">
                      {enEdicion ? (
                        <input
                          className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                          value={editNotas}
                          onChange={(e) => setEditNotas(e.target.value)}
                        />
                      ) : (
                        c.notas || "-"
                      )}
                    </td>
                    <td className="p-2 space-x-2">
                      {enEdicion ? (
                        <>
                          <button
                            className="text-sm px-2 py-1 bg-green-700 text-white"
                            onClick={guardarEdicion}
                          >
                            Guardar
                          </button>
                          <button
                            className="text-sm px-2 py-1 bg-neutral-500 text-white"
                            onClick={() => setEditId(null)}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-sm px-2 py-1 bg-blue-600 text-white"
                            onClick={() => iniciarEdicion(c)}
                          >
                            Editar
                          </button>
                          <button
                            className="text-sm px-2 py-1 bg-red-700 text-white"
                            onClick={() => borrarComponente(c.id)}
                          >
                            Borrar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* AÑADIR COMPONENTE */}
      <div className="card p-4 grid gap-2">
        <h3 className="font-semibold">Añadir componente al inventario</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <select
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Nombre / valor (ej: 10k 1/4W, BC547, 100n 50V)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) =>
              setCantidad(parseInt(e.target.value) || 0)
            }
          />
          <input
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Ubicación (cajón, caja, etc.)"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
          />
        </div>
        <textarea
          className="border p-2 mt-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          placeholder="Notas (proveedor, referencia, observaciones...)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
        <button
          className="bg-black text-white p-2 mt-2"
          onClick={agregarComponente}
        >
          Añadir
        </button>
      </div>

      {/* BÚSQUEDA EN MOUSER */}
      <div className="card p-4 grid gap-2">
        <h3 className="font-semibold">Buscar equivalentes en Mouser</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="border p-2 flex-1 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Código o referencia (ej: BC547, LM7805...)"
            value={qMouser}
            onChange={(e) => setQMouser(e.target.value)}
          />
          <button
            className="bg-black text-white px-4 py-2"
            onClick={buscarEnMouser}
            disabled={buscandoAPI}
          >
            {buscandoAPI ? "Buscando..." : "Buscar en Mouser"}
          </button>
        </div>

        {resultAPI.length > 0 && (
          <div className="mt-3">
            <table className="w-full text-sm border-t">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800">
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-left">Fabricante</th>
                  <th className="p-2 text-left">Descripción</th>
                  <th className="p-2 text-left">Enlace</th>
                  <th className="p-2 text-left">Acción</th>
                </tr>
              </thead>
              <tbody>
                {resultAPI.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-700"
                  >
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.manufacturer}</td>
                    <td className="p-2">{r.description}</td>
                    <td className="p-2">
                      <a
                        href={r.productUrl}
                        target="_blank"
                        className="text-blue-600 dark:text-blue-400 underline"
                      >
                        Ver
                      </a>
                    </td>
                    <td className="p-2">
                      <button
                        className="text-sm px-2 py-1 bg-green-700 text-white"
                        onClick={() => añadirDesdeMouser(r)}
                      >
                        Añadir al inventario
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EQUIVALENCIAS LOCALES */}
      <div className="card p-4 grid gap-2">
        <h3 className="font-semibold">Registrar equivalencia local</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Componente original"
            value={origenEq}
            onChange={(e) => setOrigenEq(e.target.value)}
          />
          <input
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Sustituto"
            value={sustitutoEq}
            onChange={(e) => setSustitutoEq(e.target.value)}
          />
          <input
            className="border p-2 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Notas (opcional)"
            value={notasEq}
            onChange={(e) => setNotasEq(e.target.value)}
          />
        </div>
        <button
          className="bg-black text-white p-2 mt-2"
          onClick={agregarEquivalencia}
        >
          Añadir equivalencia
        </button>

        {equivalencias && equivalencias.length > 0 && (
          <table className="w-full text-sm border-t mt-3">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="p-2 text-left">Origen</th>
                <th className="p-2 text-left">Sustituto</th>
                <th className="p-2 text-left">Notas</th>
              </tr>
            </thead>
            <tbody>
              {equivalencias.map((eq) => (
                <tr
                  key={eq.id}
                  className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  <td className="p-2">{eq.origen}</td>
                  <td className="p-2">{eq.sustituto}</td>
                  <td className="p-2">{eq.notas || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* IMPORTAR DESDE DOCUMENTO */}
      <ImportadorDoc />
    </section>
  );
}
