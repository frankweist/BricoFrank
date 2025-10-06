export type EstadoOrden = 'recepcion'|'diagnostico'|'reparacion'|'listo'|'entregado'
export interface Cliente { id:string; nombre:string; telefono:string; email?:string; fecha_alta:string }
export interface Equipo { id:string; clienteId:string; categoria:string; marca:string; modelo:string; numeroSerie?:string; descripcion:string; fecha_recepcion:string }
export interface Orden { id:string; codigo:string; equipoId:string; estado:EstadoOrden; creada:string; actualizada:string }
export interface Evento { id:string; ordenId:string; tipo:'nota'|'prueba'|'cambio_estado'; texto:string; fecha:string }
export interface Pieza { id:string; ordenId:string; nombre:string; cantidad:number; coste:number; estado:'pendiente'|'pedido'|'recibido'|'instalado' }
export interface Adjunto { id:string; ordenId:string; nombre:string; tipo:string; tam:number; fecha:string; blob:Blob }
