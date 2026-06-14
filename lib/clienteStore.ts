"use client";

import { FicheroCliente } from "./types";
import { guardarCliente, leerSesion } from "./sessionStore";

// Mantiene compatibilidad con módulos que llaman a estas funciones
export function guardarClienteActivo(data: FicheroCliente) {
  guardarCliente(data);
}

export function leerClienteActivo(): FicheroCliente | null {
  return leerSesion().cliente ?? null;
}

export function limpiarClienteActivo() {
  // La limpieza completa se hace desde limpiarSesion()
  sessionStorage.removeItem("efa_cliente_activo");
}
