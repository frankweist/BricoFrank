const API_URL = "https://api.nexar.com/graphql";
const API_KEY = import.meta.env.VITE_OCTOPART_API_KEY;

/**
 * Busca sustitutos o equivalentes de un componente usando la API de Nexar/Octopart.
 * @param query MPN o referencia del componente (por ejemplo "BC547")
 */
export async function buscarSustitutos(query: string) {
  if (!API_KEY) throw new Error("Falta VITE_OCTOPART_API_KEY en .env");

  const graphqlQuery = `
    query {
      supSearchMpn(q: "${query}") {
        hits
        results {
          part {
            similarParts {
              name
              mpn
              octopartUrl
            }
          }
        }
      }
    }
  `;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query: graphqlQuery }),
  });

  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const data = await res.json();

  const resultados: { name: string; mpn: string; octopartUrl: string }[] = [];

  const r = data?.data?.supSearchMpn?.results ?? [];
  for (const item of r) {
    const similars = item.part?.similarParts ?? [];
    for (const s of similars) resultados.push(s);
  }

  return resultados;
}
