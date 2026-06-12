"use client";

import { FicheroCliente } from "./types";

const KEY = "efa_cliente_activo";

export function guardarClienteActivo(data: FicheroCliente) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // almacenamiento no disponible, se ignora
  }
}

export function leerClienteActivo(): FicheroCliente | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FicheroCliente;
  } catch {
    return null;
  }
}

export function limpiarClienteActivo() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
