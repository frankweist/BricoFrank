import { useEffect, useState } from 'react';
// 🔑 CORRECCIÓN: Se añade Wrench a la importación
import { Moon, Sun, ClipboardList, Calculator, Hammer, TrendingUp, Wrench } from 'lucide-react'; 
import type { Tab } from '../../App';
import { onSyncState, getSyncState } from '../../sync/autosync'; 
// 💡 La importación de Historial no es necesaria si solo se usa en NavItem/Tab

export function Layout({
  tab, onTab, children,
}: { tab: Tab; onTab: (t: Tab) => void; children: React.ReactNode }) {

  const [dark, setDark] = useState(() => localStorage.getItem('gr_dark') === '1');
  const [syncState, setSyncState] = useState(getSyncState());

  useEffect(() => {
    const handleSyncStateChange = (state: string) => setSyncState(state);
    // Inicialización del listener de estado de sincronización. (initAutoSync se llama en main.tsx)
    onSyncState(handleSyncStateChange);
  }, []);

  // Lógica de cambio de tema:
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('gr_dark', dark ? '1' : '0');
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
  }, [dark]);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr] bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col gap-2 border-r border-neutral-200 dark:border-neutral-800 p-4 sticky top-0 h-screen">
        <h1 className="text-xl font-bold mb-4">Gestor Rep.</h1>
        {/* 🔑 Wrench se usa para Reparación, Hammer para Órdenes, o viceversa, según tu convención */}
        <NavItem icon={ClipboardList} label="Registro" active={tab === 'registro'} onClick={() => onTab('registro')} />
        <NavItem icon={Hammer} label="Órdenes" active={tab === 'ordenes'} onClick={() => onTab('ordenes')} />
        <NavItem icon={Calculator} label="Presupuesto" active={tab === 'presupuesto'} onClick={() => onTab('presupuesto')} />
        <NavItem icon={Wrench} label="Reparación" active={tab === 'reparacion'} onClick={() => onTab('reparacion')} /> 
        <NavItem icon={TrendingUp} label="Informes" active={tab === 'informes'} onClick={() => onTab('informes')} /> 
        
        <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs opacity-70">Sincronización: {syncState}</div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="grid grid-rows-[auto_1fr]">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex justify-between items-center max-w-6xl w-full mx-auto p-4">
            <h1 className="text-xl font-bold lg:hidden">Gestor Rep.</h1>
            <div className="flex gap-2 items-center">
              
              {/* Navegación para pantallas pequeñas (tabs) */}
              <button className={`tab ${tab === 'registro' ? 'tab-active' : ''}`} onClick={() => onTab('registro')}>Registro</button>
              <button className={`tab ${tab === 'ordenes' ? 'tab-active' : ''}`} onClick={() => onTab('ordenes')}>Órdenes</button>
              <button className={`tab ${tab === 'presupuesto' ? 'tab-active' : ''}`} onClick={() => onTab('presupuesto')}>Presupuesto</button>
              <button className={`tab ${tab === 'reparacion' ? 'tab-active' : ''}`} onClick={() => onTab('reparacion')}>Reparación</button>
              <button className={`tab ${tab === 'informes' ? 'tab-active' : ''}`} onClick={() => onTab('informes')}>Informes</button> 
              
              {/* Botón de Tema */}
              <button title="Tema" className="btn btn-ghost" onClick={() => setDark(v => !v)}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
          {/* Barra de estado de sincronización (visible en pantallas pequeñas) */}
          <div className="lg:hidden p-2 text-center text-xs opacity-70 border-t border-neutral-200 dark:border-neutral-800">
              Sincronización: {syncState}
          </div>
        </header>

        <main className="max-w-6xl w-full mx-auto p-4 overflow-y-auto">
          <div className="grid gap-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

// Componente NavItem
function NavItem({
  icon: Icon, label, active, onClick
}: { icon: any; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150 ${
        active
          ? 'bg-primary-500 text-white shadow-md'
          : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </button>
  );
}