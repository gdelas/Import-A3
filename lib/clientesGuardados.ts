"use client";

import { FicheroCliente } from "./types";

const KEY = "efa_clientes_guardados";

export interface ClienteGuardado {
  nombre: string;
  cif: string;
  fechaGuardado: string;
  datos: FicheroCliente;
}

export function leerClientesGuardados(): ClienteGuardado[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ClienteGuardado[];
  } catch {
    return [];
  }
}

export function guardarClienteEnLista(datos: FicheroCliente): void {
  const lista = leerClientesGuardados();
  const nombre = datos.cliente.nombre || "Sin nombre";
  const cif = datos.cliente.cif || "";

  // Actualizar si ya existe (mismo CIF o mismo nombre)
  const idxExistente = lista.findIndex(
    (c) => (cif && c.cif === cif) || c.nombre === nombre
  );

  const nuevo: ClienteGuardado = {
    nombre,
    cif,
    fechaGuardado: new Date().toLocaleDateString("es-ES"),
    datos,
  };

  if (idxExistente >= 0) {
    lista[idxExistente] = nuevo;
  } else {
    lista.push(nuevo);
  }

  localStorage.setItem(KEY, JSON.stringify(lista));
}

export function borrarClienteGuardado(nombre: string): void {
  const lista = leerClientesGuardados().filter((c) => c.nombre !== nombre);
  localStorage.setItem(KEY, JSON.stringify(lista));
}
