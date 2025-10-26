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
    // 🚀 ARREGLO FINAL: Nueva versión 3 (Importante para la migración)
    this.version(3).stores({
      clientes: 'id, nombre, telefono, fecha_alta',
      equipos: 'id, clienteId, marca, modelo, fecha_recepcion',
      ordenes: 'id, codigo, equipoId, estado, creada, actualizada, cliente, telefono, equipo', // <--- Nuevas columnas indexadas
      eventos: 'id, ordenId, fecha',
      piezas:  'id, ordenId, estado',
      adjuntos:'id, ordenId, fecha'
    })
  }
}

export const db = new GRDB()

;(window as any).db = db

