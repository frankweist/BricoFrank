import { useEffect, useState } from 'react';
import { Wrench, Moon, Sun, ClipboardList, Calculator, Hammer } from 'lucide-react';
import type { Tab } from '../../App';
import { initAutoSync, onSyncState, getSyncState } from '../../sync/autosync';
import { Registro } from "../registro/Registro";
import { Presupuesto } from "../presupuesto/Presupuesto";
import { DetalleOrden } from "../reparacion/DetalleOrden";
import { Historial } from "../historial/Historial";

export function Layout({
  tab, onTab, children,
}: { tab: Tab; onTab: (t: Tab) => void; children: React.ReactNode }) {

  const [dark, setDark] = useState(() => localStorage.getItem('gr_dark') === '1');
  const [syncState, setSyncState] = useState(getSyncState());

  useEffect(() => {
    const handleSyncStateChange = (state: string) => setSyncState(state);
    initAutoSync();
    onSyncState(handleSyncStateChange);
  }, []);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr] bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col gap-2 border-r border-neutral-200/70 dark:border-neutral-800 p-4">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Wrench className="size-5" /> Gestor
        </div>
        <nav className="mt-4 grid gap-1">
          <NavItem icon={ClipboardList} label="Registro" active={tab === 'registro'} onClick={() => onTab('registro')} />
          <NavItem icon={ClipboardList} label="Órdenes" active={tab === 'ordenes'} onClick={() => onTab('ordenes')} />
          <NavItem icon={Calculator} label="Presupuesto" active={tab === 'presupuesto'} onClick={() => onTab('presupuesto')} />
          <NavItem icon={Hammer} label="Reparación" active={tab === 'reparacion'} onClick={() => onTab('reparacion')} />
          <NavItem icon={Hammer} label="Historial" active={tab === 'historial'} onClick={() => onTab('historial')} />
        </nav>
        <div className="mt-auto pt-4 border-t border-neutral-200/70 dark:border-neutral-800">
          <button className="btn btn-ghost w-full" onClick={() => setDark(v => !v)}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="ml-2">{dark ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>
        </div>
      </aside>

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
                {syncState === 'idle' || syncState === 'ok'
				  ? 'Sincronizado'
                  : syncState === 'syncing'
                  ? 'Sincronizando…'
                  : syncState === 'offline'
                  ? 'Offline'
                  : 'Error'}
              </span>
              <button className={`tab ${tab === 'registro' ? 'tab-active' : ''}`} onClick={() => onTab('registro')}>Registro</button>
              <button className={`tab ${tab === 'ordenes' ? 'tab-active' : ''}`} onClick={() => onTab('ordenes')}>Órdenes</button>
              <button className={`tab ${tab === 'presupuesto' ? 'tab-active' : ''}`} onClick={() => onTab('presupuesto')}>Presupuesto</button>
              <button className={`tab ${tab === 'reparacion' ? 'tab-active' : ''}`} onClick={() => onTab('reparacion')}>Reparación</button>
              <button className={`tab ${tab === 'historial' ? 'tab-active' : ''}`} onClick={() => onTab('historial')}>Historial</button>
              <button title="Tema" className="btn btn-ghost" onClick={() => setDark(v => !v)}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl w-full mx-auto p-4">
          <div className="grid gap-4">{children}</div>
        </main>
      </div>
    </div>
  );
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
  );
}
