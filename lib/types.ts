export type RetencionTipo = "ninguna" | "7" | "15" | "19" | "35";

export interface ClienteMaestro {
  nombre: string;
  cif: string;
  actividad: string;
  retencion: RetencionTipo;
  prorrata: boolean;
  porcentajeProrrata: number;
  recargoEquivalencia: boolean;
  criterioCaja: boolean;
  regimenIva: "general" | "simplificado" | "exento" | "recc";
  notas: string;
}

/** Una fila del plan de cuentas del cliente: concepto del balance/PyG y su
 * cuenta/subcuenta asignada en A3. Ampliable libremente. */
export interface CuentaPlan {
  concepto: string;
  cuenta: string;
  notas?: string;
}

export interface ColumnaPlantillaA3 {
  letra: string;
  campo: string;
}

export interface FicheroCliente {
  cliente: ClienteMaestro;
  planCuentas: CuentaPlan[];
  plantillaA3: ColumnaPlantillaA3[];
  archivo: string;
}

export interface LineaAsiento {
  numAsiento: number;
  fecha: string;
  codigoOperacion: string;
  concepto: string;
  documento: string;
  cuentaDebe: string;
  importeDebe: number;
  importeHaber: number;
  cuentaHaber: string;
  origen: string;
  alerta?: string;
}

export interface FacturaExtraida {
  archivo: string;
  tipo: "venta" | "compra" | "desconocido";
  emisor: string;
  receptor: string;
  cif: string;
  numeroFactura: string;
  fecha: string;
  baseImponible: number;
  tipoIva: number;
  cuotaIva: number;
  retencionPct: number;
  retencionImporte: number;
  total: number;
  conceptos: string[];
  suplidos: number;
  alertas: string[];
}

export const PLACEHOLDER_CLIENTE: ClienteMaestro = {
  nombre: "",
  cif: "",
  actividad: "",
  retencion: "ninguna",
  prorrata: false,
  porcentajeProrrata: 100,
  recargoEquivalencia: false,
  criterioCaja: false,
  regimenIva: "general",
  notas: "",
};

/** Conceptos habituales que se ofrecen como punto de partida en el plan de
 * cuentas del cliente — pensados para cubrir clientes, proveedores, bancos
 * y las cuentas de ingreso/gasto más usadas. Ampliable por el usuario. */
export const PLAN_CUENTAS_BASE: CuentaPlan[] = [
  { concepto: "Cliente principal", cuenta: "" },
  { concepto: "Proveedor principal", cuenta: "" },
  { concepto: "Banco principal", cuenta: "572" },
  { concepto: "Caja", cuenta: "570" },
  { concepto: "Ingreso por servicios", cuenta: "705" },
  { concepto: "Ingreso por ventas de mercaderías", cuenta: "700" },
  { concepto: "Gasto general / otros servicios", cuenta: "629" },
  { concepto: "Arrendamientos", cuenta: "621" },
  { concepto: "Suministros", cuenta: "628" },
  { concepto: "IVA soportado", cuenta: "472" },
  { concepto: "IVA repercutido", cuenta: "477" },
  { concepto: "HP retenciones soportadas", cuenta: "473" },
  { concepto: "HP retenciones practicadas", cuenta: "4751" },
  { concepto: "Suplidos", cuenta: "554" },
];

export const PLANTILLA_A3_BASE: ColumnaPlantillaA3[] = [
  { letra: "A", campo: "Num asiento" },
  { letra: "B", campo: "Fecha" },
  { letra: "C", campo: "Codigo" },
  { letra: "D", campo: "Concepto" },
  { letra: "E", campo: "Documento" },
  { letra: "F", campo: "Cuenta debe" },
  { letra: "G", campo: "Importe debe" },
  { letra: "H", campo: "Importe haber" },
  { letra: "I", campo: "Cuenta haber" },
];
