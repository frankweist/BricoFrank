import { Orden, Cliente, Equipo, Adjunto } from "./db";

export type BackupPayload = {
  clientes: Cliente[];
  equipos: Equipo[];
  ordenes: Orden[];
  adjuntos: Adjunto[];
  fecha: string;
};