import { v4 as uuid } from "uuid"
import { db } from "../data/db"
import type { Cliente, Equipo, Orden, Evento } from "./types" 

// 💡 MEJORA: Tipo de cliente que permite un ID opcional para la edición/UPSERT
type ClienteInput = Pick<Cliente, "nombre" | "telefono" | "email"> & { id?: string };

export function genCodigoOrden(now = Date.now()) { return "ORD-" + now }

/** * Función auxiliar para gestionar la creación o actualización de un cliente (UPSERT).
 */
async function getOrCreateCliente(inputCliente: ClienteInput): Promise<Cliente> {
  const ahora = new Date().toISOString();
  let cliente: Cliente;

  if (inputCliente.id) {
    // 1. UPDATE: Si tiene ID, actualizamos sus datos.
    await db.clientes.update(inputCliente.id, {
      nombre: inputCliente.nombre,
      telefono: inputCliente.telefono,
      email: inputCliente.email || null, // Usar null para valores vacíos
    });
    // Obtener el cliente actualizado (o el que debería ser)
    cliente = await db.clientes.get(inputCliente.id) as Cliente;
    
    // Fallback si el cliente no existía por alguna razón (aunque Dexie.update ya devuelve 0)
    if (!cliente) {
        throw new Error(`Error: Cliente con ID ${inputCliente.id} no encontrado para actualizar.`);
    }
  } else {
    // 2. CREATE: Nuevo cliente
    const newId = uuid();
    cliente = {
      id: newId,
      nombre: inputCliente.nombre,
      telefono: inputCliente.cliente.telefono,
      email: inputCliente.email || null,
      fecha_alta: ahora
    };
    await db.clientes.add(cliente);
  }
  return cliente;
}

/** Crea cliente + equipo + orden */
export async function crearOrdenCompleta(input: {
  cliente: ClienteInput, // 💡 Ahora permite ID opcional
  equipo:  Pick<Equipo, "categoria" | "marca" | "modelo" | "numeroSerie" | "descripcion">
}) {
  const ahora = new Date().toISOString()
  
  // 💡 MEJORA: Transacción atómica
  return db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, async () => {
    
    // 1. Obtener/Crear/Actualizar Cliente
    const cliente = await getOrCreateCliente(input.cliente);
    
    // 2. Crear Equipo
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
    
    // 3. Crear Orden
    const orden: Orden = {
      id: uuid(),
      codigo: genCodigoOrden(),
      equipoId: equipo.id,
      estado: "recepcion",
      creada: ahora,
      actualizada: ahora,
      // 💡 DATOS REDUNDANTES: Para búsqueda/agrupación rápida en Ordenes.tsx
      cliente: cliente.nombre, 
      telefono: cliente.telefono, 
      equipo: `${equipo.marca} ${equipo.modelo}` 
    }
    
    // 4. Crear Evento
    const evento: Evento = {
      id: uuid(),
      ordenId: orden.id,
      tipo: "recepcion",
      texto: "Equipo recibido y registrado.",
      fecha: ahora
    }

    // 5. Guardar
    await db.equipos.add(equipo)
    await db.ordenes.add(orden)
    await db.eventos.add(evento)
    
    return { cliente, equipo, orden }
  })
}


/** Crea **un único cliente** y múltiples equipos+órdenes en una sola transacción */
export async function crearOrdenesMultiples(input: {
  cliente: ClienteInput, // 💡 Ahora permite ID opcional
  equipos: Array<Pick<Equipo, "categoria" | "marca" | "modelo" | "numeroSerie" | "descripcion"> >
}) {
  const ahora = new Date().toISOString()
  
  // 💡 MEJORA: Transacción atómica
  return db.transaction('rw', db.clientes, db.equipos, db.ordenes, db.eventos, async () => {
      
    // 1. Obtener/Crear/Actualizar Cliente
    const cliente = await getOrCreateCliente(input.cliente);

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
      actualizada: ahora,
      // 💡 DATOS REDUNDANTES
      cliente: cliente.nombre, 
      telefono: cliente.telefono, 
      equipo: `${eq.marca} ${eq.modelo}`
    }))

    const eventos: Evento[] = ordenes.map(o => ({
      id: uuid(),
      ordenId: o.id,
      tipo: "recepcion",
      texto: "Equipo recibido y registrado.",
      fecha: ahora
    }))

    // Guardar todo
    await db.equipos.bulkAdd(equipos)
    await db.ordenes.bulkAdd(ordenes)
    await db.eventos.bulkAdd(eventos)

    const resultados = ordenes.map((orden, i) => ({ cliente, equipo: equipos[i], orden }));
    return { resultados }
  })
}