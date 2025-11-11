// apps/web/src/api/mouser.ts
// ---------------------------------------------
// API gratuita de Mouser para buscar equivalentes o información de componentes
// ---------------------------------------------

const API_URL = "https://api.mouser.com/api/v1/search/partnumber";
const API_KEY = import.meta.env.VITE_MOUSER_KEY;

/**
 * Busca componentes o equivalentes usando la API de Mouser.
 * @param query Código o referencia (MPN, p.ej. "BC547")
 * @returns Array con los resultados (nombre, MPN, fabricante, enlace, descripción)
 */
export async function buscarSustitutos(query: string) {
  if (!API_KEY) throw new Error("Falta VITE_MOUSER_KEY en tu .env.local");

  const body = {
    SearchByPartRequest: {
      mouserPartNumber: query,
      partSearchOptions: "string",
    },
  };

  const res = await fetch(`${API_URL}?apiKey=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const data = await res.json();

  const results = data?.SearchResults?.Parts || [];
  return results.map((p: any) => ({
    name: p.ManufacturerPartNumber || "Sin nombre",
    mpn: p.MouserPartNumber || "N/A",
    manufacturer: p.Manufacturer?.Name || "Desconocido",
    description: p.Description || "",
    productUrl: p.ProductDetailUrl || "",
  }));
}
