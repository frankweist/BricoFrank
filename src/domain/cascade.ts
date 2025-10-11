import { db } from "../data/db"

export async function deleteOrdenCascade(ordenId: string) {
  const o = await db.ordenes.get(ordenId)
  if (!o) return
  const equipoId = o.equipoId
  await db.transaction('rw', db.ordenes, db.eventos, db.piezas, db.adjuntos, db.equipos, async () => {
    await db.eventos.where('ordenId').equals(ordenId).delete()
    await db.piezas.where('ordenId').equals(ordenId).delete()
    await db.adjuntos.where('ordenId').equals(ordenId).delete()
    await db.ordenes.delete(ordenId)
    await db.equipos.delete(equipoId)
  })
}

export async function deleteClienteCascade(clienteId: string) {
  const equipos = await db.equipos.where('clienteId').equals(clienteId).toArray()
  const ordenes = await db.ordenes.where('equipoId').anyOf(equipos.map(e => e.id)).toArray()
  await db.transaction('rw', db.eventos, db.piezas, db.adjuntos, db.ordenes, db.equipos, db.clientes, async () => {
    const ordenIds = ordenes.map(o => o.id)
    // Borrado en batch más eficiente con anyOf para evitar bucles
    await db.eventos.where('ordenId').anyOf(ordenIds).delete()
    await db.piezas.where('ordenId').anyOf(ordenIds).delete()
    await db.adjuntos.where('ordenId').anyOf(ordenIds).delete()
    await db.ordenes.where('id').anyOf(ordenIds).delete()
    await db.equipos.where('clienteId').equals(clienteId).delete()
    await db.clientes.delete(clienteId)
  })
}
