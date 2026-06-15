export type RetencionTipo = "ninguna" | "7" | "15" | "19" | "35";
export type RegimenIva = "general" | "simplificado" | "exento" | "recc";

export interface ClienteMaestro {
  nombre: string;
  cif: string;
  actividad: string;
  retencion: RetencionTipo;
  // Prorrata
  prorrata: boolean;
  porcentajeProrrata: number; // 0-100, solo relevante si prorrata=true
  // Otras particularidades
  recargoEquivalencia: boolean;
  criterioCaja: boolean;
  regimenIva: RegimenIva;
  notas: string;
}

/** Una fila del plan de cuentas del cliente */
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

export type TipoOperacion =
  | "venta"
  | "compra"
  | "venta_intracomunitaria"
  | "compra_intracomunitaria"
  | "exportacion"
  | "importacion"
  | "desconocido";

export interface FacturaExtraida {
  archivo: string;
  tipo: TipoOperacion;
  esRectificativa: boolean;
  emisor: string;
  receptor: string;
  cif: string;
  cifReceptor: string;
  numeroFactura: string;
  fecha: string;
  baseImponible: number;
  tipoIva: number;
  cuotaIva: number;
  tipoRecargo: number;
  cuotaRecargo: number;
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

export const PLAN_CUENTAS_BASE: CuentaPlan[] = [
  { concepto: "Cliente principal", cuenta: "", notas: "Subcuenta 430xxx asignada en A3" },
  { concepto: "Proveedor principal", cuenta: "", notas: "Subcuenta 400xxx asignada en A3" },
  { concepto: "Banco principal", cuenta: "572", notas: "Cuenta bancaria principal" },
  { concepto: "Caja", cuenta: "570", notas: "" },
  { concepto: "Compras de mercancías", cuenta: "600", notas: "Para empresas comerciales. En recargo de equivalencia va la base imponible." },
  { concepto: "IVA y recargo no deducible", cuenta: "601", notas: "Solo si recargo de equivalencia = Sí. IVA + recargo van aquí." },
  { concepto: "Devoluciones compras mercancías", cuenta: "608", notas: "Rectificativas de compras en recargo de equivalencia." },
  { concepto: "Ingreso por servicios", cuenta: "705", notas: "Cuenta habitual de ventas/servicios" },
  { concepto: "Ingreso por ventas de mercaderías", cuenta: "700", notas: "" },
  { concepto: "Gasto general / otros servicios", cuenta: "629", notas: "Cuenta habitual de gastos" },
  { concepto: "Arrendamientos", cuenta: "621", notas: "Alquiler de local, nave, etc." },
  { concepto: "Suministros", cuenta: "628", notas: "Luz, agua, gas, teléfono, internet" },
  { concepto: "Servicios profesionales", cuenta: "623", notas: "Abogados, asesores, etc." },
  { concepto: "Seguros", cuenta: "625", notas: "" },
  { concepto: "Servicios bancarios", cuenta: "626", notas: "Comisiones y mantenimiento" },
  { concepto: "Publicidad", cuenta: "627", notas: "" },
  { concepto: "Gastos de personal", cuenta: "640", notas: "Nóminas" },
  { concepto: "IVA soportado", cuenta: "472", notas: "" },
  { concepto: "IVA repercutido", cuenta: "477", notas: "" },
  { concepto: "HP retenciones soportadas", cuenta: "473", notas: "Retenciones que nos practican a nosotros" },
  { concepto: "HP retenciones practicadas", cuenta: "4751", notas: "Retenciones que practicamos a terceros" },
  { concepto: "Suplidos", cuenta: "554", notas: "" },
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
