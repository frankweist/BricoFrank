import React, { useState, useMemo } from 'react';

// --- 1. Tipos de Datos ---
interface PresupuestoItem {
  id: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

// --- 2. Componente Principal ---
export function Presupuesto() {
  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [nextId, setNextId] = useState(1);
  // ❌ Eliminado: const IVA = 0.21;

  // --- 3. Lógica de Cálculo ---
  const { subtotal, total } = useMemo(() => {
    // 🔑 CORRECCIÓN: Cálculo simplificado. Subtotal es la suma, Total es igual al Subtotal.
    const sub = items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const tot = sub;
    return { subtotal: sub, total: tot };
  }, [items]);

  // --- 4. Funciones de Gestión ---
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: nextId, descripcion: '', cantidad: 1, precioUnitario: 0 }
    ]);
    setNextId(nextId + 1);
  };

  const handleUpdateItem = (id: number, field: keyof Omit<PresupuestoItem, 'id'>, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'descripcion') {
          return { ...item, [field]: value as string };
        }
        // Conversión a número para cantidad/precio
        const numericValue = parseFloat(value as string) || 0;
        return { ...item, [field]: numericValue };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleExportar = () => {
    console.log("Exportando presupuesto:", { items, total });
    alert(`Presupuesto total: ${total.toFixed(2)}€ (Lógica de exportación pendiente)`);
  };

  const handleLimpiar = () => {
    setItems([]);
    setNextId(1);
  };

  // --- 5. Renderizado ---
  return (
    <div className="grid gap-6">
      <div className="card">
        <div className="card-body">
          <h2 className="text-xl font-semibold mb-4">Detalle del Presupuesto</h2>
          
          {/* Botones de acción */}
          <div className="flex gap-2 mb-4">
            <button className="btn btn-primary" onClick={handleAddItem}>+ Añadir Línea</button>
            <button className="btn btn-secondary" onClick={handleExportar} disabled={items.length === 0}>Exportar (PDF/JSON)</button>
            <button className="btn btn-ghost" onClick={handleLimpiar}>Limpiar</button>
          </div>

          {/* Tabla de Items */}
          <div className="overflow-x-auto">
            <table className="table-auto w-full text-left">
              <thead>
                <tr className="border-b border-neutral-300 dark:border-neutral-700">
                  <th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 px-2 w-24">Cant.</th>
                  <th className="py-2 px-2 w-32">P. Unitario (€)</th>
                  <th className="py-2 px-2 w-32">Total Línea (€)</th>
                  <th className="py-2 pl-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                    <tr><td colSpan={5} className="py-4 opacity-70 text-center">Añada líneas para empezar el presupuesto.</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.id} className="border-b border-neutral-200/70 dark:border-neutral-800">
                    <td className="py-2 pr-2">
                      <input 
                        className="input w-full text-sm" 
                        value={item.descripcion} 
                        onChange={(e) => handleUpdateItem(item.id, 'descripcion', e.target.value)} 
                        placeholder="Mano de obra, Pieza X, Licencia"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input 
                        className="input w-full text-sm text-center" 
                        type="number" 
                        min="1"
                        value={item.cantidad} 
                        onChange={(e) => handleUpdateItem(item.id, 'cantidad', e.target.value)} 
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input 
                        className="input w-full text-sm text-right" 
                        type="number" 
                        step="0.01"
                        value={item.precioUnitario.toFixed(2)} 
                        onChange={(e) => handleUpdateItem(item.id, 'precioUnitario', e.target.value)} 
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {(item.cantidad * item.precioUnitario).toFixed(2)}
                    </td>
                    <td className="py-2 pl-2">
                      <button className="btn btn-ghost btn-xs" onClick={() => handleRemoveItem(item.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Resumen de Totales */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-semibold mb-2">Resumen</h3>
          <div className="grid grid-cols-2 gap-2 max-w-sm ml-auto">
            
            {/* 🔑 CORRECCIÓN: Solo se muestra el Subtotal */}
            <div className="text-right">Subtotal:</div>
            <div className="text-right font-medium">{subtotal.toFixed(2)} €</div>
            
            {/* ❌ Eliminado: Visualización y cálculo de IVA */}
            
            <div className="text-right text-xl font-bold border-t pt-2 mt-2 border-neutral-400 dark:border-neutral-600">TOTAL:</div>
            <div className="text-right text-xl font-bold border-t pt-2 mt-2 border-neutral-400 dark:border-neutral-600">{total.toFixed(2)} €</div>
          </div>
        </div>
      </div>
    </div>
  );
}