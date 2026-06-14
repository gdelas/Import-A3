"use client";

/**
 * Store de sesión compartido entre módulos.
 * Usa sessionStorage para que los datos persistan mientras la pestaña
 * está abierta pero se borren al cerrarla o al pulsar "Nueva sesión".
 *
 * Estructura:
 *  - cliente: datos del módulo 02
 *  - facturas: datos extraídos del módulo 01
 *  - movimientos: datos extraídos del módulo 03
 */

import { FacturaExtraida, FicheroCliente } from "./types";

export interface MovimientoSesion {
  fecha: string;
  concepto: string;
  importe: number;
  saldo?: number;
}

export interface SesionActual {
  cliente?: FicheroCliente;
  facturas: FacturaExtraida[];
  movimientos: MovimientoSesion[];
}

const KEY = "efa_sesion";

export function leerSesion(): SesionActual {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { facturas: [], movimientos: [] };
    return JSON.parse(raw) as SesionActual;
  } catch {
    return { facturas: [], movimientos: [] };
  }
}

export function guardarCliente(cliente: FicheroCliente) {
  const s = leerSesion();
  s.cliente = cliente;
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function guardarFacturas(facturas: FacturaExtraida[]) {
  const s = leerSesion();
  s.facturas = facturas;
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function guardarMovimientos(movimientos: MovimientoSesion[]) {
  const s = leerSesion();
  s.movimientos = movimientos;
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function limpiarSesion() {
  sessionStorage.removeItem(KEY);
  // También limpia el store antiguo por compatibilidad
  sessionStorage.removeItem("efa_cliente_activo");
}

export function sesionTieneCliente(): boolean {
  return !!leerSesion().cliente;
}

export function sesionTieneFacturas(): boolean {
  return leerSesion().facturas.length > 0;
}

export function sesionTieneMovimientos(): boolean {
  return leerSesion().movimientos.length > 0;
}
