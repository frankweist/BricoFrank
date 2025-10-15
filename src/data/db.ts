import Dexie, { Table } from 'dexie'
import type { Cliente, Equipo, Orden, Evento, Pieza, Adjunto } from '../domain/types'

export class GRDB extends Dexie {
  clientes!: Table<Cliente, string>
  equipos!: Table<Equipo, string>
  ordenes!: Table<Orden, string>
  eventos!: Table<Evento, string>
  piezas!: Table<Pieza, string>
  adjuntos!: Table<Adjunto, string>

  constructor() {
    super('gestor-reparaciones')
    this.version(1).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada',
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado'
    })
    this.version(2).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada',
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado',
      adjuntos:'id, ordenId, fecha'
    })
    // 🚀 NUEVA VERSIÓN 3: Se añaden las columnas faltantes a la tabla 'ordenes'
    this.version(3).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      // Se añaden 'cliente', 'telefono', y 'equipo'
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada, cliente, telefono, equipo', 
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado',
      adjuntos:'id, ordenId, fecha'
    })
  }
}

export const db = new GRDB()