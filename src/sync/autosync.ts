import { supa } from "../data/supabase.ts";
import { db } from "../data/db";

const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6";

let syncState = "idle";
let syncTimer: any = null;
let syncInitialized = false;
let pushQueueTimer: any = null;

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
  handlers.forEach((h) => h(state));
}

// ----------------------------------------------------
//  COLA DE SUBIDA AUTOMÁTICA
// ----------------------------------------------------
export function queuePushToSupabase() {
  if (pushQueueTimer) clearTimeout(pushQueueTimer);
  pushQueueTimer = setTimeout(() => {
    if (syncState !== "syncing") syncPush();
  }, 2000);
}

// ----------------------------------------------------
//  SINCRONIZACIÓN MANUAL FORZADA
// ----------------------------------------------------
export async function forceSync() {
  setSyncState("syncing");
  console.log("⚙️ Sincronización manual forzada...");
  try {
    await syncPush(); // Subir si procede
    await syncPull(true); // Descargar siempre
    setSyncState("ok");
  } catch (error) {
    console.error("❌ Error en sincronización forzada:", error);
    setSyncState("error");
    throw error;
  }
}

// ----------------------------------------------------
//  PROTEGIDO: Subida condicional a Supabase
// ----------------------------------------------------
export async function syncPush() {
  try {
    setSyncState("syncing");
    console.log("📤 Evaluando si es necesario subir a Supabase...");

    const clientes = await db.clientes.toArray();
    const equipos = await db.equipos.toArray();
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    const localFecha = new Date(
      Math.max(
        ...ordenes.map((o: any) => new Date(o.actualizada || o.creada || 0).getTime()),
        Date.now()
      )
    );

    // Obtener fecha remota
    const { data: remoteData, error: remoteErr } = await supa
      .from("backups")
      .select("fecha")
      .eq("id", ROW_ID)
      .single();

    if (remoteErr && remoteErr.code !== "PGRST116") throw remoteErr;

    const remoteFecha = remoteData?.fecha ? new Date(remoteData.fecha) : null;

    // Comparar fechas
    if (remoteFecha && remoteFecha > localFecha) {
      console.warn("⛔ Evitado: datos locales más antiguos que los del servidor.");
      setSyncState("ok");
      return; // No subir
    }

    console.log("✅ Subiendo backup más reciente a Supabase...");
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

// ----------------------------------------------------
//  DESCARGA PROTEGIDA DESDE SUPABASE
// ----------------------------------------------------
export async function syncPull(force: boolean = false) {
  try {
    setSyncState("syncing");
    console.log("⬇️ Descargando backup desde Supabase...");

    const { data, error } = await supa
      .from("backups")
      .select("payload, fecha")
      .eq("id", ROW_ID)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const backupData = data?.payload as any;
    const remoteDate = data?.fecha ? new Date(data.fecha) : null;

    if (!backupData) {
      console.log("⚠️ No se encontró backup válido en Supabase. Se mantienen los datos locales.");
      setSyncState("ok");
      return;
    }

    const localOrdenCount = await db.ordenes.count();
    const latestLocalOrder = await db.ordenes.orderBy("actualizada").last();
    const remoteIsNewer =
      remoteDate && remoteDate > new Date(latestLocalOrder?.actualizada || 0);

    if (localOrdenCount === 0 || force || remoteIsNewer) {
      console.log(
        `🔄 Restaurando backup remoto. Causa: ${
          localOrdenCount === 0 ? "Local vacío" : force ? "Forzado" : "Remoto más reciente"
        }`
      );

      const { clientes, equipos, ordenes, adjuntos } = backupData;

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

// ----------------------------------------------------
//  SINCRONIZACIÓN AUTOMÁTICA PERIÓDICA
// ----------------------------------------------------
export function initAutoSync(intervalMs = 120000) {
  if (syncInitialized) return;

  if (syncTimer) clearInterval(syncTimer);
  console.log("⚙️ AutoSync activado cada", intervalMs / 1000, "segundos");

  try {
    db.on("changes", (changes) => {
      if (!navigator.onLine) return;

      const relevant = changes.some(
        (c) => c.table === "clientes" || c.table === "ordenes" || c.table === "equipos"
      );
      if (relevant) queuePushToSupabase();
    });
  } catch (e) {
    console.error("❌ Error al adjuntar listener de Dexie:", e);
  }

  syncPull().then(async () => {
    const { data } = await supa.from("backups").select("id").eq("id", ROW_ID);
    if (!data || data.length === 0) {
      console.log("🔥 No hay backup remoto, forzando Push inicial...");
      syncPush();
    }
  });

  syncTimer = setInterval(() => {
    if (syncState !== "syncing") syncPull();
  }, intervalMs);

  syncInitialized = true;
}

// ----------------------------------------------------
//  EXPONER A CONSOLA PARA DIAGNÓSTICO
// ----------------------------------------------------
;(window as any).forceSync = forceSync;
