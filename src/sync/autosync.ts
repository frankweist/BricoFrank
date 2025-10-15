import { supa } from "../data/supabase";
import { db } from "../data/db";

// 🆔 Identificador único de backup principal (¡Asegúrate que sea el UUID correcto!)
const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6"; 

let syncState = "idle";
let syncTimer: any = null;
let syncInitialized = false; // Nuevo: Flag para saber si se ha corrido el sync inicial

// ... (getSyncState y onSyncState permanecen sin cambios) ...

export function getSyncState() {
  return syncState;
}

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
  // ... (Esta función permanece como la versión que sube clientes, equipos, y ordenes, y AÑADE la 'fecha' al payload) ...
  try {
    setSyncState("syncing");
    console.log("📤 Subiendo backup a Supabase...");

    const clientes = await db.clientes.toArray();
    const equipos = await db.equipos.toArray(); 
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    // El campo 'fecha' es clave para la lógica de Pull
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

    const backupData = data?.payload as any;

    // Lógica 1: No hay backup en Supabase. No hacemos nada.
    if (!backupData || !backupData.fecha) {
      console.log("⚠️ No se encontró backup válido en Supabase. Se mantendrán los datos locales.");
      setSyncState("ok");
      return; // 🛑 CLAVE: SI NO HAY BACKUP REMOTO, NO BORRAMOS LOS DATOS LOCALES.
    }

    const remoteDate = new Date(backupData.fecha);

    // Lógica 2: Compara la fecha remota con la local.
    const localOrdenCount = await db.ordenes.count();
    const latestLocalOrder = await db.ordenes.orderBy('actualizada').last();
    
    // Si la base de datos local está vacía O el backup remoto es más nuevo.
    if (localOrdenCount === 0 || remoteDate > new Date(latestLocalOrder?.actualizada || 0)) {
        
        console.log("🔄 Restaurando backup remoto más reciente...");
        
        const { clientes, equipos, ordenes, adjuntos } = backupData;

        // Limpia e inserta los datos locales
        await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.adjuntos, async () => {
          await db.clientes.clear();
          await db.equipos.clear(); 
          await db.ordenes.clear();
          await db.adjuntos.clear();

          await db.clientes.bulkAdd(clientes || []);
          await db.equipos.bulkAdd(equipos || []); 
          await db.ordenes.bulkAdd(ordenes || []);
          await db.adjuntos.bulkAdd(adjuntos || []);
        });

        console.log("✅ Datos restaurados desde Supabase.");
    } else {
        console.log("Datos locales más recientes o iguales. No se realiza pull.");
    }

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
  
  // 🛑 CLAVE: Solo hacemos el Pull si no hemos inicializado el sync.
  if (!syncInitialized) {
      syncPull().then(async () => {
          // Si no hay backup remoto, forzamos la creación del primero desde la app de PC.
          const { data } = await supa.from("backups").select("id").eq("id", ROW_ID);
          if (!data || data.length === 0) {
              console.log("🔥 No hay backup remoto, forzando un Push inicial...");
              syncPush();
          }
          syncInitialized = true;
      });
  }

  // Luego sincronizar periódicamente (push)
  syncTimer = setInterval(() => {
    if (syncState !== "syncing") syncPush();
  }, intervalMs);
}