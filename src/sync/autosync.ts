import { supa } from "../data/supabase";
import { db } from "../data/db";
import { BackupPayload } from "../data/backup";
import { DBCoreChange } from "dexie";

const ROW_ID = "2f647c2d-8b01-447a-8959-1e35520937a6";

let syncState = "idle";
let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncInitialized = false;
let pushQueueTimer: ReturnType<typeof setTimeout> | null = null;

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

export async function syncPush() {
  try {
    setSyncState("syncing");
    console.log("📤 Evaluando si es necesario subir a Supabase...");

    const clientes = await db.clientes.toArray();
    const equipos = await db.equipos.toArray();
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    console.log(
      `📦 Preparando backup local: ${clientes.length} clientes, ${equipos.length} equipos, ${ordenes.length} órdenes`
    );

    const { data: remoteData, error: remoteErr } = await supa
      .from("backups")
      .select("payload, fecha")
      .eq("id", ROW_ID)
      .single();

    if (remoteErr && remoteErr.code !== "PGRST116") throw remoteErr;

    const remoteBackup = remoteData?.payload as BackupPayload | undefined;
    const remoteOrdenes = remoteBackup?.ordenes?.length || 0;
    const remoteFecha = remoteData?.fecha ? new Date(remoteData.fecha) : null;

    const maxLocalTimestamp = ordenes.length > 0 ? Math.max(
      ...ordenes.map(o => new Date(o.actualizada || o.creada || 0).getTime())
    ) : 0;
    const localFecha = new Date(Math.max(maxLocalTimestamp, Date.now()));

    if (remoteOrdenes > ordenes.length) {
      console.warn(
        `⛔ Evitado: la base local (${ordenes.length}) tiene menos órdenes que la remota (${remoteOrdenes}). No se sube.`
      );
      setSyncState("ok");
      return;
    }

    if (remoteFecha && remoteFecha > localFecha) {
      console.warn(
        "⛔ Evitado: el backup remoto es más reciente. No se sube nada."
      );
      setSyncState("ok");
      return;
    }

    console.log("✅ Subiendo backup más reciente a Supabase...");
    const payload: BackupPayload = {
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
  } catch (err: unknown) {
    console.error("❌ Error en syncPush:", (err as Error).message);
    setSyncState("error");
  }
}

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

    const backupData = data?.payload as BackupPayload | undefined;
    const remoteDate = data?.fecha ? new Date(data.fecha) : null;

    if (!backupData) {
      console.log("⚠️ No se encontró backup válido en Supabase.");
      setSyncState("ok");
      return;
    }

    const localOrdenCount = await db.ordenes.count();
    const latestLocalOrder = await db.ordenes.orderBy("actualizada").last();
    const localDate = latestLocalOrder
      ? new Date(latestLocalOrder.actualizada || latestLocalOrder.creada)
      : new Date(0);

    const delta = remoteDate && localDate ? (remoteDate.getTime() - localDate.getTime()) : 0;
    const remoteIsNewer = delta > 5000;

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

        if(clientes) await db.clientes.bulkAdd(clientes);
        if(equipos) await db.equipos.bulkAdd(equipos);
        if(ordenes) await db.ordenes.bulkAdd(ordenes);
        if(adjuntos) await db.adjuntos.bulkAdd(adjuntos);
      });

      console.log("✅ Datos restaurados desde Supabase.");
    } else {
      console.log("Datos locales más recientes o iguales. No se realiza pull.");
    }

    setSyncState("ok");
  } catch (err: unknown) {
    console.error("❌ Error en syncPull:", (err as Error).message);
    setSyncState("error");
  }
}

export function initAutoSync(intervalMs = 120000) {
  if (syncInitialized) return;

  if (syncTimer) clearInterval(syncTimer);
  console.log("⚙️ AutoSync activado cada", intervalMs / 1000, "segundos");

  try {
    db.on("changes", (changes: DBCoreChange[]) => {
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