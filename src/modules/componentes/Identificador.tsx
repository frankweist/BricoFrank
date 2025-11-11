import { useState } from "react";
import { db } from "../../data/db";
import { v4 as uuid } from "uuid";
import { buscarSustitutos } from "../../api/mouser";

/**
 * Identificador de componentes
 * - Busca localmente y en Mouser
 * - Muestra tipo, descripción, datasheet
 * - Permite guardar en inventario
 */

type Componente = {
  id: string;
  tipo: string;
  nombre: string;
  cantidad: number;
  ubicacion?: string;
  notas?: string;
  fecha_alta: string;
};

function deducirTipo(nombre: string, descripcion: string): string {
  const t = (nombre + " " + descripcion).toLowerCase();
  if (t.includes("resistor") || t.includes("ohm")) return "Resistencias";
  if (t.includes("capacitor") || t.includes("condensador") || t.includes("uf")) return "Condensadores";
  if (t.includes("diode") || t.includes("rectifier")) return "Diodos";
  if (t.includes("transistor") || t.includes("bjt") || t.includes("mosfet") || t.includes("fet")) return "Transistores";
  if (t.includes("regulator") || t.includes("ldo") || t.includes("dc-dc")) return "Reguladores";
  if (t.includes("relay")) return "Relés";
  if (t.includes("fuse")) return "Fusibles";
  if (t.includes("connector") || t.includes("header")) return "Conectores";
  if (t.includes("ic") || t.includes("integrated circuit")) return "IC / Chips";
  return "Otros";
}

export function Identificador() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<Componente | null>(null);
  const [datasheet, setDatasheet] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function identificar() {
    const q = codigo.trim();
    if (!q) return;
    setBuscando(true);
    setMensaje("");
    setResultado(null);
    setDatasheet(null);

    // 1. Buscar en base local
    const local = await db.componentes
      .where("nombre")
      .equalsIgnoreCase(q)
      .first();

    if (local) {
      setResultado(local);
      setMensaje("✅ Encontrado en tu base local.");
      setBuscando(false);
      return;
    }

    // 2. Buscar en Mouser
    try {
      const res = await buscarSustitutos(q);
      if (!res || res.length === 0) {
        setMensaje("❌ No se encontraron datos en Mouser.");
      } else {
        const d = res[0];
        const tipo = deducirTipo(d.name, d.description);
        const nuevo: Componente = {
          id: uuid(),
          tipo,
          nombre: d.name,
          cantidad: 1,
          ubicacion: "",
          notas: `${d.manufacturer} / ${d.mpn} - ${d.description}${
            d.productUrl ? " | " + d.productUrl : ""
          }`,
          fecha_alta: new Date().toISOString(),
        };
        setResultado(nuevo);
        setDatasheet(d.productUrl || null);
        setMensaje("ℹ️ Datos obtenidos de Mouser.");
      }
    } catch (e) {
      setMensaje("❌ Error al consultar Mouser: " + (e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  async function guardar() {
    if (!resultado) return;
    await db.componentes.add(resultado);
    setMensaje("✅ Componente guardado en el inventario.");
    setResultado(null);
    setCodigo("");
    setDatasheet(null);
  }

  return (
    <div className="card p-4 grid gap-3">
      <h3 className="text-lg font-semibold">Identificador de componentes</h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="border p-2 flex-1 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          placeholder="Código o serigrafía del componente (ej: BC547, LM317, IRF540N, 10k)"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <button
          className="bg-black text-white px-4 py-2"
          onClick={identificar}
          disabled={buscando}
        >
          {buscando ? "Buscando..." : "Identificar"}
        </button>
      </div>

      {mensaje && <p className="text-sm opacity-80">{mensaje}</p>}

      {resultado && (
        <div className="border-t pt-2 mt-2">
          <h4 className="font-semibold mb-1">Resultado:</h4>
          <table className="w-full text-sm border">
            <tbody>
              <tr>
                <td className="p-2 font-semibold w-32">Tipo</td>
                <td className="p-2">{resultado.tipo}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Nombre</td>
                <td className="p-2">{resultado.nombre}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Descripción</td>
                <td className="p-2">{resultado.notas}</td>
              </tr>
              {datasheet && (
                <tr>
                  <td className="p-2 font-semibold">Datasheet</td>
                  <td className="p-2">
                    <a
                      href={datasheet}
                      target="_blank"
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      Ver hoja de datos
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <button
            className="bg-green-700 text-white px-4 py-2 mt-3"
            onClick={guardar}
          >
            Guardar en inventario
          </button>
        </div>
      )}
    </div>
  );
}
