﻿import { useEffect, useState } from 'react';
import { Moon, Sun, ClipboardList, Calculator, Hammer, TrendingUp, Wrench, BookOpenText, Package } from 'lucide-react'; 
import type { Tab } from '../../App';
import { onSyncState, getSyncState } from '../../sync/autosync'; 

const navItems = [
  { tab: 'registro', label: 'Registro', icon: BookOpenText },
  { tab: 'ordenes', label: 'Órdenes', icon: ClipboardList },
  { tab: 'presupuesto', label: 'Presupuesto', icon: Calculator },
  { tab: 'reparacion', label: 'Reparación', icon: Wrench },
  { tab: 'historial', label: 'Historial', icon: Hammer },
  { tab: 'informes', label: 'Informes', icon: TrendingUp },
  { tab: 'componentes', label: 'Componentes', icon: Package },
] as const; 

export function Layout({
  tab, onTab, children,
}: { tab: Tab; onTab: (t: Tab) => void; children: React.ReactNode }) {

  const [dark, setDark] = useState(() => localStorage.getItem('gr_dark') === '1');
  const [syncState, setSyncState] = useState(getSyncState());

  useEffect(() => {
    const handleSyncStateChange = (state: string) => setSyncState(state);
    onSyncState(handleSyncStateChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('gr_dark', dark ? '1' : '0');
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
  }, [dark]);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr] bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:flex-col gap-2 border-r border-neutral-200 dark:border-neutral-800 p-4 sticky top-0 h-screen">
        <h1 className="text-xl font-bold p-2 mb-4">Gestor de Reparaciones</h1>
        
        {navItems.map(item => (
          <NavItem
            key={item.tab}
            icon={item.icon}
            label={item.label}
            active={tab === item.tab}
            onClick={() => onTab(item.tab as Tab)} 
          />
        ))}

        <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
            <p className="text-xs opacity-70">Sincronización: {syncState}</p>
            <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Tema</p>
                <button title="Tema" className="btn btn-ghost" onClick={() => setDark(v => !v)}>
                    {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
                </button>
            </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="flex flex-col h-screen overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-6xl mx-auto p-2 lg:p-0">
            <div className="flex gap-2 p-2 overflow-x-auto lg:hidden justify-between">
              {navItems.map(item => (
                <button 
                  key={item.tab} 
                  className={`tab ${tab === item.tab ? 'tab-active' : ''}`} 
                  onClick={() => onTab(item.tab as Tab)}
                >
                  {item.label}
                </button>
              ))}
              <button title="Tema" className="btn btn-ghost flex-shrink-0" onClick={() => setDark(v => !v)}>
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
          <div className="lg:hidden p-2 text-center text-xs opacity-70 border-t border-neutral-200 dark:border-neutral-800">
              Sincronización: {syncState}
          </div>
        </header>

        <main className="max-w-6xl w-full mx-auto p-4 overflow-y-auto flex-grow">
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
      className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150 ${
        active
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-100'
          : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </button>
  );
}
