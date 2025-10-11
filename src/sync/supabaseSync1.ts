import { supa } from "../data/supabase"
import { db } from "../data/db"

export async function pushAllSupabase() {
  if (!supa) throw new Error("Supabase no configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.")
  const payload = {
    clientes: await db.clientes.toArray(),
    equipos:  await db.equipos.toArray(),
    ordenes:  await db.ordenes.toArray(),
    eventos:  await db.eventos.toArray(),
    piezas:   await db.piezas.toArray(),
  }
  const { error } = await supa.from("backups").insert({ payload })
  if (error) throw error
}

export async function pullLatestSupabase(): Promise<boolean> {
  if (!supa) throw new Error("Supabase no configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.")
  const { data, error } = await supa
    .from("backups")
    .select("created_at,payload")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return false
  const p: any = data.payload || {}
  await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.eventos, db.piezas, async () => {
    await db.clientes.clear(); await db.equipos.clear()
    await db.ordenes.clear();  await db.eventos.clear(); await db.piezas.clear()
    if (p.clientes) await db.clientes.bulkAdd(p.clientes)
    if (p.equipos)  await db.equipos.bulkAdd(p.equipos)
    if (p.ordenes)  await db.ordenes.bulkAdd(p.ordenes)
    if (p.eventos)  await db.eventos.bulkAdd(p.eventos)
    if (p.piezas)   await db.piezas.bulkAdd(p.piezas)
  })
  return true
}
