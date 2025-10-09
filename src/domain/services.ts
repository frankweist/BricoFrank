import { v4 as uuid } from "uuid"
import { db } from "../data/db"
import type { Cliente, Equipo, Orden, Evento } from "./types"

export function genCodigoOrden(now = Date.now()) { return "ORD-" + now }

/** Crea cliente + equipo + orden */
export async function crearOrdenCompleta(input: {
  cliente: Pick<Cliente, "nombre" | "telefono" | "email">,
  equipo:  Pick<Equipo, "categoria" | "marca" | "modelo" | "numeroSerie" | "descripcion">
}) {
  const ahora = new Date().toISOString()
  const cliente: Cliente = {
    id: uuid(),
    nombre: input.cliente.nombre,
    telefono: input.cliente.telefono,
    email: input.cliente.email,
    fecha_alta: ahora
  }
  const equipo: Equipo = {
    id: uuid(),
    clienteId: cliente.id,
    categoria: input.equipo.categoria,
    marca: input.equipo.marca,
    modelo: input.equipo.modelo,
    numeroSerie: input.equipo.numeroSerie,
    descripcion: input.equipo.descripcion,
    fecha_recepcion: ahora
  }
  const orden: Orden = {
    id: uuid(),
    codigo: genCodigoOrden(),
    equipoId: equipo.id,
    estado: "recepcion",
    creada: ahora,
    actualizada: ahora
  }
  const evento: Evento = { id: uuid(), ordenId: orden.id, tipo: "nota", texto: "Orden creada", fecha: ahora }

  await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.eventos, async () => {
    await db.clientes.add(cliente)
    await db.equipos.add(equipo)
    await db.ordenes.add(orden)
    await db.eventos.add(evento)
  })
  return { cliente, equipo, orden }
}

/** Crea equipo + orden para cliente existente */
export async function crearOrdenParaCliente(input: {
  clienteId: string,
  equipo: Pick<Equipo, "categoria" | "marca" | "modelo" | "numeroSerie" | "descripcion">
}) {
  const ahora = new Date().toISOString()
  const equipo: Equipo = {
    id: uuid(),
    clienteId: input.clienteId,
    categoria: input.equipo.categoria,
    marca: input.equipo.marca,
    modelo: input.equipo.modelo,
    numeroSerie: input.equipo.numeroSerie,
    descripcion: input.equipo.descripcion,
    fecha_recepcion: ahora
  }
  const orden: Orden = {
    id: uuid(),
    codigo: genCodigoOrden(),
    equipoId: equipo.id,
    estado: "recepcion",
    creada: ahora,
    actualizada: ahora
  }
  const evento: Evento = { id: uuid(), ordenId: orden.id, tipo: "nota", texto: "Orden creada para cliente existente", fecha: ahora }

  await db.transaction("rw", db.equipos, db.ordenes, db.eventos, async () => {
    await db.equipos.add(equipo)
    await db.ordenes.add(orden)
    await db.eventos.add(evento)
  })
  return { equipo, orden }
}

/** Crea **un único cliente** y múltiples equipos+órdenes en una sola transacción */
export async function crearOrdenesMultiples(input: {
  cliente: Pick<Cliente, "nombre" | "telefono" | "email">,
  equipos: Array<Pick<Equipo, "categoria" | "marca" | "modelo" | "numeroSerie" | "descripcion">>
}) {
  const ahora = new Date().toISOString()
  const cliente: Cliente = {
    id: uuid(),
    nombre: input.cliente.nombre,
    telefono: input.cliente.telefono,
    email: input.cliente.email,
    fecha_alta: ahora
  }

  const equipos: Equipo[] = input.equipos.map(e => ({
    id: uuid(),
    clienteId: cliente.id,
    categoria: e.categoria,
    marca: e.marca,
    modelo: e.modelo,
    numeroSerie: e.numeroSerie,
    descripcion: e.descripcion,
    fecha_recepcion: ahora
  }))

  const ordenes: Orden[] = equipos.map(eq => ({
    id: uuid(),
    codigo: genCodigoOrden(),
    equipoId: eq.id,
    estado: "recepcion",
    creada: ahora,
    actualizada: ahora
  }))

  const eventos: Evento[] = ordenes.map(o => ({
    id: uuid(),
    ordenId: o.id,
    tipo: "nota",
    texto: "Orden creada (alta múltiple)",
    fecha: ahora
  }))

  await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.eventos, async () => {
    await db.clientes.add(cliente)
    await db.equipos.bulkAdd(equipos)
    await db.ordenes.bulkAdd(ordenes)
    await db.eventos.bulkAdd(eventos)
  })

  return {
    cliente,
    equipos,
    ordenes
  }
}
