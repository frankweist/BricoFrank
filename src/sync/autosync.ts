import { supa } from "../data/supabase.ts"; // Asegúrate de que la ruta relativa sea correcta si moviste el archivo
import { db } from "../data/db";

// 🆔 Identificador único de backup principal (¡Asegúrate que sea el UUID correcto!)
const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6"; 

let syncState = "idle";
let syncTimer: any = null;
let syncInitialized = false; 
let pushQueueTimer: any = null; // Timer para el debounced push


// ----------------------------------------------------
// MANEJO DE ESTADO DE SINCRONIZACIÓN
// ----------------------------------------------------

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


// ----------------------------------------------------
// SINCRONIZACIÓN MANUAL Y POR EVENTO
// ----------------------------------------------------

/**
 * Pone en cola una subida de datos con un pequeño retraso (debounce).
 * Se usa en db.ts (db.on("changes")).
 */
export function queuePushToSupabase() {
    if (pushQueueTimer) {
        clearTimeout(pushQueueTimer);
    }
    // Espera 2 segundos después del último cambio antes de hacer el push.
    pushQueueTimer = setTimeout(() => {
        if (syncState !== "syncing") {
            syncPush();
        }
    }, 2000); 
}

/**
 * Fuerza una sincronización completa (Push + Pull). Usada por el botón manual.
 */
export async function forceSync() {
    setSyncState("syncing"); 
    console.log("⚙️ Sincronización manual forzada...");
    try {
        await syncPush(); // 1. Subir cambios locales (solo si hay cambios)
        await syncPull(true); // 2. Descargar cambios de la nube (FORZANDO la descarga)
        setSyncState("ok");
    } catch (error) {
        console.error("❌ Error en sincronización forzada:", error);
        setSyncState("error");
        // Volvemos a lanzar el error para que el componente que lo llama lo maneje
        throw error; 
    }
}


// ----------------------------------------------------
// LÓGICA DE SINCRONIZACIÓN EXISTENTE
// ----------------------------------------------------

// 🟢 Sube la base de datos local a Supabase
export async function syncPush() {
  try {
    setSyncState("syncing");
    console.log("📤 Subiendo backup a Supabase...");

    const clientes = await db.clientes.toArray();
	const equipos = await db.equipos.toArray();
	const ordenes = await db.ordenes.toArray();
	const piezas = await db.piezas.toArray();
	const adjuntos = await db.adjuntos.toArray();

	const payload = { clientes, equipos, ordenes, piezas, adjuntos, fecha: new Date().toISOString() };


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
// 🔑 CORRECCIÓN CRÍTICA: Se añade un parámetro 'force'
export async function syncPull(force: boolean = false) {
  try {
    setSyncState("syncing");
    console.log("⬇️ Descargando backup desde Supabase...");

    const { data, error } = await supa
      .from("backups")
      .select("payload, fecha") // También seleccionamos la fecha para comparación
      .eq("id", ROW_ID)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 es 'no se encontró una sola fila', lo manejamos abajo

    const backupData = data?.payload as any;
    const remoteDate = data?.fecha ? new Date(data.fecha) : null;

    // Lógica 1: No hay backup en Supabase.
    if (!backupData) {
      console.log("⚠️ No se encontró backup válido en Supabase. Se mantendrán los datos locales.");
      setSyncState("ok");
      return; 
    }

    // Lógica 2: Compara la fecha remota con la local.
    const localOrdenCount = await db.ordenes.count();
    const latestLocalOrder = await db.ordenes.orderBy('actualizada').last();
    
    // CONDICIÓN CORREGIDA: Si la base de datos local está vacía O se forzó la sincronización O el backup remoto es más nuevo.
    const remoteIsNewer = remoteDate && remoteDate > new Date(latestLocalOrder?.actualizada || 0);
    
    if (localOrdenCount === 0 || force || remoteIsNewer) {
        
        console.log(`🔄 Restaurando backup remoto. Causa: ${localOrdenCount === 0 ? 'Local vacío' : force ? 'Sincronización forzada' : 'Remoto más reciente'}`);
        
        const { clientes, equipos, ordenes, piezas, adjuntos } = backupData;
		await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.piezas, db.adjuntos, async () => {
		  await db.clientes.clear(); await db.equipos.clear(); await db.ordenes.clear(); await db.piezas.clear(); await db.adjuntos.clear();
		  await db.clientes.bulkAdd(clientes || []);
          await db.equipos.bulkAdd(equipos || []);
		  await db.ordenes.bulkAdd(ordenes || []);
          await db.piezas.bulkAdd(piezas || []);
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
  // 💡 CORRECCIÓN 1: Si ya está inicializado, salimos inmediatamente.
  if (syncInitialized) return; 

  if (syncTimer) clearInterval(syncTimer);
  console.log("⚙️ AutoSync activado cada", intervalMs / 1000, "segundos");
  
  // 💡 CORRECCIÓN 2: Adjuntamos el listener de Dexie FUERA del .then()
  try {
      db.on("changes", (changes) => {
          if (!navigator.onLine) return; 

          const relevantChanges = changes.some(c => 
              c.table === "clientes" || 
              c.table === "ordenes" || 
              c.table === "equipos" 
          );

          if (relevantChanges) {
              queuePushToSupabase(); 
          }
      });
  } catch(e) {
      console.error("❌ Error al adjuntar listener de Dexie:", e);
  }

  // Realizamos el Pull inicial para abrir la base de datos y obtener datos remotos.
  syncPull().then(async () => {
      // Este código se ejecuta SOLO después del primer Pull exitoso.
      const { data } = await supa.from("backups").select("id").eq("id", ROW_ID);
      if (!data || data.length === 0) {
          console.log("🔥 No hay backup remoto, forzando un Push inicial...");
          syncPush();
      }
  });

  // Se sincroniza periódicamente
  syncTimer = setInterval(() => {
    if (syncState !== "syncing") syncPull(); 
  }, intervalMs);
  
  syncInitialized = true;
}

// Permitir ejecutar forceSync desde consola (solo para diagnóstico)
;(window as any).forceSync = forceSync
