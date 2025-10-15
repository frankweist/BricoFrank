import { supa } from "../data/supabase";
import { db } from "../data/db";

// 🆔 Identificador único de backup principal
const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6"; // puedes sustituirlo por tu UUID real si prefieres

let syncState = "idle";
let syncTimer: any = null;

// ✅ ARREGLO 1: Exportar getSyncState para que Layout.tsx pueda usarlo
export function getSyncState() {
  return syncState;
}

// Handler para notificar a los componentes de cambios de estado
const handlers: ((state: string) => void)[] = [];

export function onSyncState(handler: (state: string) => void) {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i !== -1) handlers.splice(i, 1);
  };
}

function setSyncState(state: string) {
  syncState = state;
  handlers.forEach(h => h(state));
}


// 🟢 Sube la base de datos local a Supabase
export async function syncPush() {
  try {
    setSyncState("syncing");
    console.log("📤 Subiendo backup a Supabase...");

    const clientes = await db.clientes.toArray();
    const equipos = await db.equipos.toArray(); // ✅ ARREGLO: Obtener equipos
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    // ✅ ARREGLO: Incluir equipos en el payload
    const payload = { clientes, equipos, ordenes, adjuntos, fecha: new Date().toISOString() };

    const { error } = await supa
      .from("backups")
      .upsert([{ id: ROW_ID, fecha: new Date().toISOString(), payload }], { onConflict: "id" });

    if (error) throw error;

    console.log("✅ Backup subido correctamente.");
    setSyncState("ok");
  } catch (err: any) {
    console.error("❌ Error en syncPush:", err.message);
    setSyncState("error");
  }
}

// 🔵 Descarga los datos desde Supabase a la base local
export async function syncPull() {
  try {
    setSyncState("syncing");
    console.log("⬇️ Descargando backup desde Supabase...");

    const { data, error } = await supa
      .from("backups")
      .select("payload")
      .eq("id", ROW_ID)
      .single();

    if (error) throw error;
    if (!data?.payload) throw new Error("Sin payload válido en backup remoto");

    // ✅ ARREGLO: Destructurar equipos
    const { clientes, equipos, ordenes, adjuntos } = data.payload as any;

    // Limpia e inserta los datos locales
    // ✅ ARREGLO: Incluir db.equipos en la transacción, limpiar y añadir
    await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.adjuntos, async () => {
      await db.clientes.clear();
      await db.equipos.clear(); // Limpiar equipos
      await db.ordenes.clear();
      await db.adjuntos.clear();

      await db.clientes.bulkAdd(clientes || []);
      await db.equipos.bulkAdd(equipos || []); // Añadir equipos
      await db.ordenes.bulkAdd(ordenes || []);
      await db.adjuntos.bulkAdd(adjuntos || []);
    });

    console.log("✅ Datos restaurados desde Supabase.");
    setSyncState("ok");
  } catch (err: any) {
    console.error("❌ Error en syncPull:", err.message);
    setSyncState("error");
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