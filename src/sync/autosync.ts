import Dexie from 'dexie'
import { supa } from "../data/supabase.ts";
import { db } from "../data/db";


const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6";

let syncState = "idle";
let syncTimer: any = null;
let syncInitialized = false;
let pushQueueTimer: any = null;

// --- NUEVO: indicador visual de sincronización ---
function showSyncInfo(type: "push" | "pull" | "skip", date: Date) {
  const id = "sync-toast";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.style.position = "fixed";
    el.style.bottom = "8px";
    el.style.right = "8px";
    el.style.zIndex = "9999";
    el.style.padding = "6px 10px";
    el.style.borderRadius = "8px";
    el.style.fontSize = "12px";
    el.style.background = "#1e293b";
    el.style.color = "white";
    el.style.opacity = "0.9";
    document.body.appendChild(el);
  }
  const txt =
    type === "push"
      ? "Subida (Push)"
      : type === "pull"
      ? "Descarga (Pull)"
      : "Sin cambios";
  el.textContent = `Última sincronización: ${date.toLocaleString()} [${txt}]`;
}
// -------------------------------------------------

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

export function queuePushToSupabase() {
  if (pushQueueTimer) clearTimeout(pushQueueTimer);
  pushQueueTimer = setTimeout(() => {
    if (syncState !== "syncing") syncPush();
  }, 2000);
}

export async function forceSync() {
  setSyncState("syncing");
  console.log("⚙️ Sincronización manual forzada...");
  try {
    await syncPush();
    await syncPull(true);
    setSyncState("ok");
  } catch (error) {
    console.error("❌ Error en sincronización forzada:", error);
    setSyncState("error");
    throw error;
  }
}

// ----------------------------------------------------
// PROTEGIDO: Subida condicional a Supabase
// ----------------------------------------------------
export async function syncPush() {
  try {
    setSyncState("syncing");
    console.log("📤 Evaluando si es necesario subir a Supabase...");

    // Leer datos locales completos
    const clientes = await db.clientes.toArray();
    const equipos = await db.equipos.toArray();
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    console.log(
      `📦 Preparando backup local: ${clientes.length} clientes, ${equipos.length} equipos, ${ordenes.length} órdenes`
    );

    // --- Leer backup remoto actual ---
    const { data: remoteData, error: remoteErr } = await supa
      .from("backups")
      .select("payload, fecha")
      .eq("id", ROW_ID)
      .single();

    if (remoteErr && remoteErr.code !== "PGRST116") throw remoteErr;

    const remoteBackup = remoteData?.payload;
    const remoteOrdenes = remoteBackup?.ordenes?.length || 0;
    const remoteFecha = remoteData?.fecha ? new Date(remoteData.fecha) : null;

    const localFecha = new Date(
      Math.max(
        ...ordenes.map(o => new Date(o.actualizada || o.creada || 0).getTime()),
        Date.now()
      )
    );

    // --- Protección: no sobrescribir si la local parece incompleta ---
    if (remoteOrdenes > ordenes.length) {
      console.warn(
        `⛔ Evitado: la base local (${ordenes.length}) tiene menos órdenes que la remota (${remoteOrdenes}). No se sube.`
      );
      setSyncState("ok");
      return;
    }

    // --- Comprobar si el remoto es más reciente ---
    if (remoteFecha && remoteFecha > localFecha) {
      console.warn(
        "⛔ Evitado: el backup remoto es más reciente. No se sube nada."
      );
      setSyncState("ok");
      return;
    }

    // --- Subir el backup ---
    console.log("✅ Subiendo backup más reciente a Supabase...");
    const payload = {
      clientes,
      equipos,
      ordenes,
      adjuntos,
      fecha: new Date().toISOString(),
    };

    const { error } = await supa
      .from("backups")
      .upsert([{ id: ROW_ID, fecha: new Date().toISOString(), payload }], {
        onConflict: "id",
      });

    if (error) throw error;

    console.log("✅ Backup subido correctamente.");
    setSyncState("ok");
  } catch (err: any) {
    console.error("❌ Error en syncPush:", err.message);
    setSyncState("error");
  }
}



// ----------------------------------------------------
// DESCARGA PROTEGIDA DESDE SUPABASE
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
      console.log("⚠️ No se encontró backup válido en Supabase.");
      setSyncState("ok");
      return;
    }

    // Datos locales
    const localOrdenCount = await db.ordenes.count();
    const latestLocalOrder = await db.ordenes.orderBy("actualizada").last();
    const localDate = latestLocalOrder
      ? new Date(latestLocalOrder.actualizada || latestLocalOrder.creada)
      : new Date(0);

    // --- Comparación corregida ---
    const delta = remoteDate && localDate ? (remoteDate.getTime() - localDate.getTime()) : 0;
    const remoteIsNewer = delta > 5000; // más de 5 segundos de diferencia se considera más nuevo

    if (localOrdenCount === 0 || force || remoteIsNewer) {
      console.log(
        `🔄 Restaurando backup remoto. Causa: ${
          localOrdenCount === 0
            ? "Local vacío"
            : force
            ? "Sincronización forzada"
            : `Remoto más reciente (+${Math.round(delta / 1000)}s)`
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
      showSyncInfo?.("pull", new Date());
    } else {
      console.log("Datos locales más recientes o iguales. No se realiza pull.");
      showSyncInfo?.("skip", new Date());
    }

    setSyncState("ok");
  } catch (err: any) {
    console.error("❌ Error en syncPull:", err.message);
    setSyncState("error");
  }
}


// ----------------------------------------------------
// SINCRONIZACIÓN AUTOMÁTICA
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
// EXPONER FUNCIÓN A CONSOLA
// ----------------------------------------------------
;(window as any).forceSync = forceSync;
