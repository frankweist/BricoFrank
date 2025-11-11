import { useState } from "react";
import { db } from "../../data/db";
import { v4 as uuid } from "uuid";

/**
 * Analiza líneas de texto y detecta tipo de componente y valor.
 * Ejemplos válidos:
 *  R10 10k 1/4W
 *  C5 100n 50V
 *  Q1 BC547
 *  D2 1N4148
 *  U2 7805
 */

type ItemDetectado = {
  id: string;
  tipo: string;
  nombre: string;
  cantidad: number;
  ubicacion: string;
};

function detectarTipo(linea: string): string {
  const l = linea.trim().toUpperCase();
  if (/^R\d*/.test(l)) return "Resistencia";
  if (/^C\d*/.test(l)) return "Condensador";
  if (/^D\d*/.test(l)) return "Diodo";
  if (/^Q\d*/.test(l)) return "Transistor";
  if (/^U\d*/.test(l) || /LM78/.test(l) || /AMS/.test(l)) return "Regulador";
  if (/^L\d*/.test(l)) return "Inductor";
  if (/^IC/.test(l) || /\bOP\b/.test(l)) return "IC / Chip";
  return "Otros";
}

function limpiarValor(linea: string): string {
  const partes = linea.trim().split(/\s+/);
  partes.shift(); // eliminar el prefijo (R10, C5, etc.)
  return partes.join(" ");
}

export function ImportadorDoc() {
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<ItemDetectado[]>([]);
  const [guardando, setGuardando] = useState(false);

  function analizar() {
    const lineas = texto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const detectados: ItemDetectado[] = lineas.map((l) => ({
      id: uuid(),
      tipo: detectarTipo(l),
      nombre: limpiarValor(l),
      cantidad: 1,
      ubicacion: "",
    }));
    setItems(detectados);
  }

  async function guardarTodos() {
    if (items.length === 0) return;
    setGuardando(true);
    try {
      await db.transaction("rw", db.componentes, async () => {
        for (const i of items) {
          await db.componentes.add({
            id: uuid(),
            tipo: i.tipo,
            nombre: i.nombre,
            cantidad: i.cantidad,
            ubicacion: i.ubicacion,
            fecha_alta: new Date().toISOString(),
          });
        }
      });
      alert(`✅ ${items.length} componentes guardados en el inventario.`);
      setItems([]);
      setTexto("");
    } catch (err) {
      alert("Error al guardar: " + (err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  function actualizarCampo(id: string, campo: keyof ItemDetectado, valor: string | number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i))
    );
  }

  return (
    <div className="card p-4 grid gap-3">
      <h3 className="font-semibold text-lg">Importar desde documento</h3>
      <textarea
        className="border p-2 h-32 bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
        placeholder="Pega aquí las líneas del documento (por ejemplo: R10 10k 1/4W, C5 100n 50V...)"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="bg-black text-white px-3 py-2"
          onClick={analizar}
          disabled={!texto.trim()}
        >
          Analizar
        </button>
        {items.length > 0 && (
          <button
            className="bg-green-700 text-white px-3 py-2"
            onClick={guardarTodos}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar todos"}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-t mt-3">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800">
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Nombre / Valor</th>
                <th className="p-2 text-left">Cantidad</th>
                <th className="p-2 text-left">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-700">
                  <td className="p-2">
                    <input
                      className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                      value={i.tipo}
                      onChange={(e) => actualizarCampo(i.id, "tipo", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                      value={i.nombre}
                      onChange={(e) => actualizarCampo(i.id, "nombre", e.target.value)}
                    />
                  </td>
                  <td className="p-2 w-24">
                    <input
                      type="number"
                      min={1}
                      className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                      value={i.cantidad}
                      onChange={(e) =>
                        actualizarCampo(i.id, "cantidad", parseInt(e.target.value))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border p-1 w-full bg-white dark:bg-neutral-800 dark:text-neutral-100"
                      value={i.ubicacion}
                      onChange={(e) =>
                        actualizarCampo(i.id, "ubicacion", e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
