import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { crearOrdenCompleta, crearOrdenesMultiples } from "../../domain/services"
import { db } from "../../data/db"

type ClienteDB = {
  id: string
  nombre: string
  telefono: string
  email?: string
}

type EquipoForm = {
  aparato: string
  marca: string
  modelo: string
  numeroSerie: string
  descripcion: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
      {children}
    </label>
  )
}

export function Registro({ onCreated }: { onCreated: (ordenId: string) => void }) {
  const [cliente, setCliente] = useState({ nombre: "", telefono: "", email: "" })
  const [equipos, setEquipos] = useState<EquipoForm[]>([
    { aparato: "", marca: "", modelo: "", numeroSerie: "", descripcion: "" },
  ])
  const [suggestions, setSuggestions] = useState<ClienteDB[]>([])

  const clientesDB = useLiveQuery(() => db.clientes.toArray(), []) || []

  function handleNombreChange(name: string) {
    setCliente({ ...cliente, nombre: name })
    if (name.length > 2) {
      const filtered = clientesDB.filter((c) =>
        c.nombre.toLowerCase().includes(name.toLowerCase())
      )
      setSuggestions(filtered)
    } else setSuggestions([])
  }

  function selectCliente(selected: ClienteDB) {
    setCliente({
      nombre: selected.nombre,
      telefono: selected.telefono,
      email: selected.email || "",
    })
    setSuggestions([])
  }

  const can =
    !!cliente.nombre &&
    !!cliente.telefono &&
    equipos.every((e) => e.marca && e.modelo && e.descripcion && e.aparato)

  function updateEq(i: number, patch: Partial<EquipoForm>) {
    setEquipos((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  function addEquipo() {
    setEquipos((prev) => [
      ...prev,
      { aparato: "", marca: "", modelo: "", numeroSerie: "", descripcion: "" },
    ])
  }

  function removeEquipo(i: number) {
    setEquipos((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function crearOrdenes() {
    if (!can) return
    const clienteData = {
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email || undefined,
    }

    if (equipos.length === 1) {
      const { id } = await crearOrdenCompleta({ cliente: clienteData, equipo: equipos[0] })
      onCreated(id)
    } else {
      const { ids } = await crearOrdenesMultiples({ cliente: clienteData, equipos })
      if (ids.length > 0) onCreated(ids[0])
    }
  }

  return (
    <section className="grid gap-4">
      <div className="card">
        <div className="card-body grid gap-4">
          <h2 className="text-lg font-semibold">Datos del Cliente</h2>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="relative">
              <Field label={"Nombre completo*"}>
                <input
                  className="input"
                  value={cliente.nombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
                />
              </Field>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-b-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-sm border-b dark:border-neutral-700"
                      onClick={() => selectCliente(s)}
                    >
                      {s.nombre} ({s.telefono})
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Field label={"Teléfono*"}>
              <input
                type="tel"
                className="input"
                value={cliente.telefono}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
              />
            </Field>

            <Field label={"Email"}>
              <input
                type="email"
                className="input"
                value={cliente.email}
                onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
              />
            </Field>
          </div>

          <hr className="my-2" />

          <h2 className="text-lg font-semibold">Datos del Equipo ({equipos.length})</h2>

          <div className="grid gap-4">
            {equipos.map((eq, i) => (
              <div key={i} className="card border-primary-500/50 border shadow-lg">
                <div className="card-body grid gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-md font-semibold">Equipo {i + 1}</h3>
                    {equipos.length > 1 && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeEquipo(i)}
                      >
                        Eliminar Equipo
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-4 gap-3">
                    <Field label={"Aparato*"}>
                      <input
                        className="input"
                        value={eq.aparato}
                        onChange={(e) => updateEq(i, { aparato: e.target.value })}
                        placeholder="Ejemplo: Sierra, Portátil, Móvil..."
                      />
                    </Field>
                    <Field label={"Marca*"}>
                      <input
                        className="input"
                        value={eq.marca}
                        onChange={(e) => updateEq(i, { marca: e.target.value })}
                      />
                    </Field>
                    <Field label={"Modelo*"}>
                      <input
                        className="input"
                        value={eq.modelo}
                        onChange={(e) => updateEq(i, { modelo: e.target.value })}
                      />
                    </Field>
                    <Field label={"Nº de serie"}>
                      <input
                        className="input"
                        value={eq.numeroSerie}
                        onChange={(e) => updateEq(i, { numeroSerie: e.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label={"Daño inicial*"}>
                    <textarea
                      className="input min-h-28"
                      value={eq.descripcion}
                      onChange={(e) => updateEq(i, { descripcion: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <div>
              <button className="btn" onClick={addEquipo}>
                Añadir otro equipo
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!can} onClick={crearOrdenes}>
              Crear orden(es)
            </button>
            <button
              className="btn"
              onClick={() => {
                setCliente({ nombre: "", telefono: "", email: "" })
                setEquipos([{ aparato: "", marca: "", modelo: "", numeroSerie: "", descripcion: "" }])
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
