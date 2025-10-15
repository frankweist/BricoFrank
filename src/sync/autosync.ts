import { supa } from "../data/supabase";
import { db } from "../data/db";

// 🆔 Identificador único de backup principal
const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6"; // puedes sustituirlo por tu UUID real si prefieres

let syncState = "idle";
let syncTimer: any = null;

// 🔔 Lista de callbacks para notificar cuando el estado cambie
const listeners: ((state: string) => void)[] = [];

// ⚙️ Función interna para actualizar el estado y notificar a los oyentes
function setSyncState(newState: string) {
  syncState = newState;
  listeners.forEach(callback => callback(newState));
}

// 🟢 Permite suscribirse a cambios de estado. (Esta es la función que faltaba)
export function onSyncState(callback: (state: string) => void) {
  listeners.push(callback);
  // Retorna una función para desuscribirse
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

export function getSyncState() {
  return syncState;
}

// 🟢 Sube la base de datos local a Supabase
export async function syncPush() {
  try {
    setSyncState("syncing"); // USAMOS LA FUNCIÓN, NO LA ASIGNACIÓN DIRECTA
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
    setSyncState("ok"); // USAMOS LA FUNCIÓN
  } catch (err: any) {
    console.error("❌ Error en syncPush:", err.message);
    setSyncState("error"); // USAMOS LA FUNCIÓN
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
      .eq("id", ROW_ID); // <--- QUITAMOS .single()

    if (error) throw error;

    // 💡 Lógica corregida: Si data es vacío (no hay backup), salimos.
    const backupData = data?.[0]?.payload;

    if (!backupData) {
      console.log("⚠️ No se encontró backup en Supabase para este ID. Inicializando vacío.");
      setSyncState("ok");
      return; // Salimos graciosamente
    }

    const { clientes, ordenes, adjuntos } = backupData;

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
  // 💡 LÍNEA A AÑADIR (Solo para desarrollo y consola)
  (window as any).syncPush = syncPush;
}