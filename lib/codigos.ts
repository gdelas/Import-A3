"use client";

export interface CodigoOperacion {
  codigo: string;
  descripcion: string;
  tipo: "venta" | "compra" | "banco" | "nomina" | "impuesto" | "otro";
}

export const CODIGOS_BASE: CodigoOperacion[] = [
  { codigo: "01", descripcion: "Ventas", tipo: "venta" },
  { codigo: "034", descripcion: "Compras con IVA", tipo: "compra" },
  { codigo: "061", descripcion: "Compras sin IVA", tipo: "compra" },
];

const KEY = "efa_codigos_operacion";

export function leerCodigos(): CodigoOperacion[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return CODIGOS_BASE;
    const parsed = JSON.parse(raw) as CodigoOperacion[];
    if (!Array.isArray(parsed) || parsed.length === 0) return CODIGOS_BASE;
    return parsed;
  } catch {
    return CODIGOS_BASE;
  }
}

export function guardarCodigos(codigos: CodigoOperacion[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(codigos));
  } catch {
    // no-op
  }
}

export function restaurarCodigosBase() {
  guardarCodigos(CODIGOS_BASE);
}
