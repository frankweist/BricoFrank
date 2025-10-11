import { useState, useMemo, useEffect, useRef } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "../../data/db"
import { crearOrdenParaCliente } from "../../domain/services"

function fmtBytes(n: number) {
  if (n < 1024) return n + " B"
  const k = 1024, u = ["KB", "MB", "GB", "TB"]
  let i = -1, v = n
  do { v /= k; i++ } while (v >= k && i < u.length - 1)
  return v.toFixed(1) + " " + u[i]
}

const NOTE_TEMPLATES = [ /* ... */ ]
const DIAG_TEMPLATES = [ /* ... */ ]

type PiezaEstado = "pendiente" | "pedido" | "recibido" | "instalado"
type EquipoForm = { categoria: string; marca: string; modelo: string; numeroSerie?: string; descripcion: string }

export function DetalleOrden({ ordenId }: { ordenId: string }) {
  // Estados y hooks...

  // Funciones...

  // -------- UI --------
  return (
    <section className="grid gap-4">
      {/* ... JSX limpiado y corregido ... */}

      <div className="card">
        <div className="card-body grid gap-2">
          {files?.length ? (
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
              {files.map(f => {
                const isImg = /^image\//.test(f.tipo)
                const url = URL.createObjectURL(f.blob)
                return (
                  <div key={f.id} className="card">
                    <div className="card-body grid gap-2">
                      <div className="text-sm break-all">{f.nombre}</div>
                      <div className="text-xs opacity-70">{fmtBytes(f.tam)} {"\u2022"} {new Date(f.fecha).toLocaleString()}</div>
                      {isImg ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={f.nombre} className="w-full h-32 object-cover rounded-lg border border-neutral-200/70 dark:border-neutral-800" />
                        </a>
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer" className="btn">Descargar</a>
                      )}
                      <div className="flex gap-2">
                        <a className="btn" href={url} download={f.nombre}>Guardar</a>
                        <button className="btn" onClick={() => borrarAdjunto(f.id)}>Borrar</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin adjuntos.</p>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="card">
            <div className="card-body flex items-center gap-2">
              <span>{toast.msg}</span>
              {toast.action && (
                <button className="btn btn-primary" onClick={() => { toast.action?.(); setToast(null) }}>Deshacer</button>
              )}
              <button className="btn" onClick={() => setToast(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
