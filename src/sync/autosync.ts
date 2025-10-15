import { supa } from "../data/supabase";
import { db } from "../data/db";

// 🆔 Identificador único de backup principal
const ROW_ID = "default"; // puedes sustituirlo por tu UUID real si prefieres

let syncState = "idle";
let syncTimer: any = null;

export function getSyncState() {
  return syncState;
}

// 🟢 Sube la base de datos local a Supabase
export async function syncPush() {
  try {
    syncState = "syncing";
    console.log("📤 Subiendo backup a Supabase...");

    const clientes = await db.clientes.toArray();
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    const payload = { clientes, ordenes, adjuntos, fecha: new Date().toISOString() };

    const { error } = await supa
      .from("backups")
      .upsert([{ id: ROW_ID, fecha: new Date().toISOString(), payload }], { onConflict: "id" });

    if (error) throw error;

    console.log("✅ Backup subido correctamente.");
    syncState = "ok";
  } catch (err: any) {
    console.error("❌ Error en syncPush:", err.message);
    syncState = "error";
  }
}

// 🔵 Descarga los datos desde Supabase a la base local
export async function syncPull() {
  try {
    syncState = "syncing";
    console.log("⬇️ Descargando backup desde Supabase...");

    const { data, error } = await supa
      .from("backups")
      .select("payload")
      .eq("id", ROW_ID)
      .single();

    if (error) throw error;
    if (!data?.payload) throw new Error("Sin payload válido en backup remoto");

    const { clientes, ordenes, adjuntos } = data.payload;

    // Limpia e inserta los datos locales
    await db.transaction("rw", db.clientes, db.ordenes, db.adjuntos, async () => {
      await db.clientes.clear();
      await db.ordenes.clear();
      await db.adjuntos.clear();

      await db.clientes.bulkAdd(clientes || []);
      await db.ordenes.bulkAdd(ordenes || []);
      await db.adjuntos.bulkAdd(adjuntos || []);
    });

    console.log("✅ Datos restaurados desde Supabase.");
    syncState = "ok";
  } catch (err: any) {
    console.error("❌ Error en syncPull:", err.message);
    syncState = "error";
  }
}

// 🔁 Inicializa el autosync automático
export function initAutoSync(intervalMs = 120000) {
  if (syncTimer) clearInterval(syncTimer);
  console.log("⚙️ AutoSync activado cada", intervalMs / 1000, "segundos");

  // Al iniciar, hacer pull
  syncPull();

  // Luego sincronizar periódicamente (push)
  syncTimer = setInterval(() => {
    if (syncState !== "syncing") syncPush();
  }, intervalMs);
}
