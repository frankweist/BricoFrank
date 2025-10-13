import { supa } from "../data/supabase";
// @protected-import
import { db } from "../data/db";

export type SyncState = "idle"|"syncing"|"offline"|"error";
let state: SyncState = "idle";
let listeners: Array<(s:SyncState)=>void> = [];
const setState = (s:SyncState)=>{ state=s; listeners.forEach(l=>l(s)); };
export const onSyncState = (cb:(s:SyncState)=>void)=>{ listeners.push(cb); return ()=>{listeners = listeners.filter(x=>x!==cb);} };
export const getSyncState = ()=> state;

const ROW_ID = "277527f0-53d3-4334-ae97-4ce2a1d9de9e";

async function dumpDB(){
  const [clientes,equipos,ordenes,eventos,piezas,adjuntos] = await Promise.all([
    db.clientes.toArray(), 
    db.equipos.toArray(), 
    db.ordenes.toArray(), 
    db.eventos.toArray(), 
    db.piezas.toArray(),
    db.adjuntos.toArray()  // agregado adjuntos
  ]);
  return { clientes,equipos,ordenes,eventos,piezas,adjuntos };
}
async function importDB(data:any){
  if(!data) return;
  await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.eventos, db.piezas, db.adjuntos, async ()=>{
    await db.clientes.clear(); await db.equipos.clear(); await db.ordenes.clear(); await db.eventos.clear(); await db.piezas.clear(); await db.adjuntos.clear();
    if(data.clientes?.length) await db.clientes.bulkAdd(data.clientes);
    if(data.equipos?.length)  await db.equipos.bulkAdd(data.equipos);
    if(data.ordenes?.length)  await db.ordenes.bulkAdd(data.ordenes);
    if(data.eventos?.length)  await db.eventos.bulkAdd(data.eventos);
    if(data.piezas?.length)   await db.piezas.bulkAdd(data.piezas);
    if(data.adjuntos?.length) await db.adjuntos.bulkAdd(data.adjuntos);
  });
}

export async function pullNow(){
  if(!supa){ return; }
  try{
    setState("syncing");
    const { data, error } = await supa.from("backups").select("*").eq("id", ROW_ID).single();
    if(error && (error as any).code!=="PGRST116"){ throw error; }
    const remoteTs = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
    const localTs  = Number(localStorage.getItem("gr_lastSyncAt")||"0");
    if(remoteTs > localTs && data?.payload){
      await importDB(data.payload);
      localStorage.setItem("gr_lastSyncAt", String(remoteTs));
    }
    setState("idle");
  }catch(e:any){
    setState(e?.message?.includes("Failed to fetch")?"offline":"error");
  }
}

export async function pushNow() {
  if (!supa) { return; }
  try {
    setState("syncing");
    const payload = await dumpDB();
    const nowIso = new Date().toISOString();
    const { error } = await supa.from("backups").upsert(
      { id: ROW_ID, payload, fecha: nowIso },
      { onConflict: "id" }
    );
    if (error) { throw error; }
    localStorage.setItem("gr_lastSyncAt", String(new Date(nowIso).getTime()));
    setState("idle");
  } catch (e: any) {
    setState(e?.message?.includes("Failed to fetch") ? "offline" : "error");
  }
}


let timerStarted = false;
export function initAutoSync(){
  if(timerStarted) return;
  timerStarted = true;
  pullNow();
  setInterval(()=>{ pushNow(); }, 60_000);
  window.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="hidden"){ pushNow(); } });
}




