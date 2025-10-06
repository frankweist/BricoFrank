# Gestor de Reparaciones â€” BricoFrank

SPA con React + TypeScript + Vite, persistencia local con IndexedDB (Dexie) y UI con Tailwind.

## Caracteristicas
- Registro de cliente con multiples equipos por alta. Categorias incluyen Baterias.
- Ordenes: busqueda, filtros (estado/fecha), ordenacion, Exportar CSV e Importar JSON.
- Presupuesto: calculo de mano de obra y piezas SIN IVA.
- Reparacion: costes, presets de tarifa, atajos de horas, timeline con plantillas, piezas, adjuntos, edicion de datos, Exportar JSON e Imprimir.

## Requisitos
- Node 18+ (recomendado 20+)
- npm 9+

## Instalacion y arranque
```bash
npm install
npm run dev
```

## Scripts
- npm run dev â€” desarrollo
- npm run build â€” produccion
- npm run preview â€” previsualizacion del build

## Estructura
```
apps/web/
  index.html
  package.json
  postcss.config.js
  src/
    App.tsx
    styles.css
    data/db.ts
    domain/types.ts
    modules/
      app/Layout.tsx
      registro/Registro.tsx
      ordenes/Ordenes.tsx
      presupuesto/Presupuesto.tsx
      reparacion/DetalleOrden.tsx
```

## Modelo de datos (Dexie)
- clientes: id, nombre, telefono, email?, fecha_alta
- equipos: id, clienteId, categoria, marca, modelo, numeroSerie?, descripcion, fecha_recepcion
- ordenes: id, codigo, equipoId, estado, creada, actualizada
- eventos: id, ordenId, tipo(nota|prueba|cambio_estado), texto, fecha
- piezas: id, ordenId, nombre, cantidad, coste, estado(pendiente|pedido|recibido|instalado)
- adjuntos (v2): id, ordenId, nombre, tipo, tam, fecha, blob

Estados: recepcion | diagnostico | reparacion | listo | entregado.

## Flujos
1) Registro -> crea 1 orden por equipo.
2) Ordenes -> buscar/filtrar y abrir.
3) Reparacion -> notas, piezas, adjuntos, costes, edicion, estados.
4) Exportar/Imprimir -> CSV/JSON o impresion.

## Exportar / Importar
- CSV desde Ordenes.
- JSON completo desde Reparacion.
- Importar JSON en Ordenes (sobrescribe tablas).

## Despliegue (GitHub Pages)
1) Ajusta base en vite.config.ts a "/NOMBRE_REPO/".
2) npm run build
3) Publica dist/ (por ejemplo, rama gh-pages).

## Troubleshooting
- Acentos: usar UTF-8 o escapes \\uXXXX si el editor cambia la codificacion.
- Tailwind 4: @tailwindcss/postcss en postcss.config.js.
- Cache Vite: borrar node_modules/.vite.

## Licencia
Privado. Uso interno BricoFrank.
