import { useEffect, useState } from 'react'
import { Wrench, Moon, Sun, ClipboardList, Calculator, Hammer } from 'lucide-react'
import type { Tab } from '../../App'
import { initAutoSync, onSyncState, getSyncState } from '../../sync/autosync'

import { Registro } from "../registro/Registro";
import { Presupuesto } from "../presupuesto/Presupuesto";
import { DetalleOrden } from "../reparacion/DetalleOrden";
import { Historial } from "../historial/Historial";
import { useSeleccion } from "../../store/seleccion";
import { Listados } from "@core/data";

export function Layout({
  tab, onTab, children,
}: { tab: Tab; onTab: (t: Tab) => void; children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('gr_dark') === '1');
  const [syncState, setSyncState] = useState(getSyncState());

  const [vista, setVista] = useState<"registro" | "presupuesto" | "detalle" | "historial">("registro");
  const { ordenId } = useSeleccion();
  const [resumen, setResumen] = useState<{ codigo?: string; cliente?: string; equipo?: string }>({});

  useEffect(() => {
    if (!ordenId) { setResumen({}); return; }
    Listados.obtenerOrdenDetallada(ordenId).then(o => {
      if (!o) return setResumen({});
      setResumen({
        codigo: o.codigo_orden,
        cliente: o.cliente?.nombre,
        equipo: o.aparato ? `${o.aparato.marca} ${o.aparato.modelo}` : undefined
      });
    });
  }, [ordenId]);

  useEffect(() => {
    const handleSyncStateChange = (state: string) => {
      setSyncState(state)
    }
    initAutoSync()
    onSyncState(handleSyncStateChange)
  }, [])

  return (
    <div className="container space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="h1">Gestor de Reparaciones</h1>
        <nav className="tabs">
          <button className={`tab ${vista === 'registro' ? 'tab-active' : ''}`} onClick={() => setVista("registro")}>Registro</button>
          <button className={`tab ${vista === 'presupuesto' ? 'tab-active' : ''}`} onClick={() => setVista("presupuesto")}>Presupuesto</button>
          <button className={`tab ${vista === 'detalle' ? 'tab-active' : ''}`} onClick={() => setVista("detalle")}>Reparación</button>
          <button className={`tab ${vista === 'historial' ? 'tab-active' : ''}`} onClick={() => setVista("historial")}>Historial</button>
        </nav>
      </header>

      {resumen.codigo && (
        <div className="card text-sm">
          <b>Orden activa:</b> {resumen.codigo} · <b>Cliente:</b> {resumen.cliente ?? "—"} · <b>Equipo:</b> {resumen.equipo ?? "—"}
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-neutral-200/70 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/70 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <Wrench className="size-5 lg:hidden" />
            <h1 className="font-semibold">Gestor de Reparaciones</h1>
            <div className="ml-auto flex items-center gap-2">
              <span
                data-sync-chip
                className={`tab ${syncState === 'idle' ? 'tab-active' : ''}`}
                title={syncState}
              >
                {syncState === 'idle' ? 'Sincronizado' : syncState === 'syncing' ? 'Sincronizando…' : syncState === 'offline' ? 'Offline' : 'Error'}
              </span>
              <button className={`tab ${tab === 'registro' ? 'tab-active' : ''}`} onClick={() => onTab('registro')}>Registro</button>
              <button className={`tab ${tab === 'ordenes' ? 'tab-active' : ''}`} onClick={() => onTab('ordenes')}>Órdenes</button>
              <button className={`tab ${tab === 'presupuesto' ? 'tab-active' : ''}`} onClick={() => onTab('presupuesto')}>Presupuesto</button>
              <button className={`tab ${tab === 'reparacion' ? 'tab-active' : ''}`} onClick={() => onTab('reparacion')}>Reparación</button>
              <button title="Tema" className="btn btn-ghost" onClick={() => setDark(v => !v)}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-6xl w-full mx-auto p-4">
          <div className="grid gap-4">
            {children}
            {vista === "registro" && <section className="card"><Registro /></section>}
            {vista === "presupuesto" && <section className="card"><Presupuesto /></section>}
            {vista === "detalle" && <section className="card"><DetalleOrden /></section>}
            {vista === "historial" && <section className="card"><Historial /></section>}
          </div>
        </main>
      </div>
    </div>
  )
}

function NavItem({
  icon: Icon, label, active, onClick
}: { icon: any; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900 ${active ? 'bg-neutral-100 dark:bg-neutral-900 font-medium' : ''}`}
    >
      <Icon className="size-4" /> <span>{label}</span>
    </button>
  )
}
