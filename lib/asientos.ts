import { ClienteMaestro, CuentaPlan, FacturaExtraida, LineaAsiento, TipoOperacion } from "./types";
import { buscarCuenta } from "./excel";
import { leerCodigos } from "./codigos";

// ─── Obtener código de operación desde la tabla editable ────────────────────
function obtenerCodigo(tipo: "venta" | "compraConIva" | "compraSinIva" | "intracomunitaria" | "exportacion"): string {
  const codigos = typeof window !== "undefined" ? leerCodigos() : [];
  switch (tipo) {
    case "venta":
      return codigos.find((c) => c.tipo === "venta")?.codigo || "01";
    case "compraConIva":
      return codigos.filter((c) => c.tipo === "compra").find((c) => !c.descripcion.toLowerCase().includes("sin iva"))?.codigo
        || codigos.find((c) => c.tipo === "compra")?.codigo || "034";
    case "compraSinIva":
      return codigos.filter((c) => c.tipo === "compra").find((c) => c.descripcion.toLowerCase().includes("sin iva"))?.codigo
        || "061";
    case "intracomunitaria":
      return codigos.find((c) => c.tipo === "otro" && c.descripcion.toLowerCase().includes("intracomunit"))?.codigo || "010";
    case "exportacion":
      return codigos.find((c) => c.tipo === "otro" && c.descripcion.toLowerCase().includes("export"))?.codigo || "01";
    default:
      return "01";
  }
}

// ─── Últimos N dígitos del número de factura ────────────────────────────────
function ultimos(nf: string, n: number): string {
  const soloNum = (nf || "").replace(/\D/g, "");
  return soloNum.slice(-n).padStart(n, "0") || nf.slice(-n) || nf;
}

// ─── Formatear concepto y documento ────────────────────────────────────────
function formatearConcepto(factura: FacturaExtraida, tipo: "emitida" | "recibida"): string {
  const num6 = ultimos(factura.numeroFactura, 6);
  const prefijo = factura.esRectificativa
    ? tipo === "recibida" ? "Su fra. rect. nº" : "Ntra. fra. rect. nº"
    : tipo === "recibida" ? "Su fra. nº" : "Ntra. fra. nº";
  const emisorReceptor = tipo === "recibida" ? factura.emisor : factura.receptor;
  return `${prefijo} ${num6} - ${emisorReceptor || ""}`.trim();
}

function formatearDocumento(factura: FacturaExtraida): string {
  return ultimos(factura.numeroFactura, 6);
}

// ─── Función principal ──────────────────────────────────────────────────────
export function generarAsientosFactura(
  factura: FacturaExtraida,
  cliente: ClienteMaestro,
  planCuentas: CuentaPlan[],
  numAsiento: number
): LineaAsiento[] {

  const tipo = factura.tipo as TipoOperacion;

  // Delegar al generador correcto
  switch (tipo) {
    case "venta":
      return generarVentaNormal(factura, cliente, planCuentas, numAsiento);
    case "compra":
      return generarCompraNormal(factura, cliente, planCuentas, numAsiento);
    case "venta_intracomunitaria":
      return generarVentaIntracomunitaria(factura, cliente, planCuentas, numAsiento);
    case "compra_intracomunitaria":
      return generarCompraIntracomunitaria(factura, cliente, planCuentas, numAsiento);
    case "exportacion":
      return generarExportacion(factura, cliente, planCuentas, numAsiento);
    case "importacion":
      return generarImportacion(factura, cliente, planCuentas, numAsiento);
    default:
      return [{
        numAsiento, fecha: factura.fecha, codigoOperacion: "",
        concepto: `${factura.archivo} — tipo de operación no determinado`,
        documento: formatearDocumento(factura),
        cuentaDebe: "", importeDebe: factura.total,
        importeHaber: 0, cuentaHaber: "",
        origen: factura.archivo,
        alerta: "Revisar manualmente: tipo de operación no determinado.",
      }];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// VENTA NORMAL (con IVA español)
// ═══════════════════════════════════════════════════════════════════════
function generarVentaNormal(
  f: FacturaExtraida,
  c: ClienteMaestro,
  plan: CuentaPlan[],
  num: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const alertas = [...f.alertas];
  const codigo = obtenerCodigo("venta");
  const concepto = formatearConcepto(f, "emitida");
  const doc = formatearDocumento(f);
  const cuentaCliente = buscarCuenta(plan, f.receptor, "Cliente principal", "Cliente") || "430";
  const cuentaIngreso = buscarCuenta(plan, "Ingreso por servicios", "Ingreso") || "705";
  const cuentaIvaRep = buscarCuenta(plan, "IVA repercutido") || "477";

  if (cuentaCliente === "430") alertas.push(`Sin subcuenta asignada para "${f.receptor}" — se usa 430 genérica.`);

  const totalCobrar = round2(f.total - f.retencionImporte);

  // Cargo cliente
  filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaCliente, totalCobrar, 0, "", f.archivo));

  // Retención soportada
  if (f.retencionImporte > 0) {
    const cuentaRet = buscarCuenta(plan, "HP retenciones soportadas") || "473";
    filas.push(fila(num, f.fecha, codigo, `Retención ${f.retencionPct}% - ${concepto}`, doc, cuentaRet, round2(f.retencionImporte), 0, "", f.archivo));
  }

  // Abono ingreso
  filas.push(fila(num, f.fecha, codigo, concepto, doc, "", 0, round2(f.baseImponible), cuentaIngreso, f.archivo));

  // IVA repercutido
  if (f.cuotaIva > 0) {
    filas.push(fila(num, f.fecha, codigo, `IVA ${f.tipoIva}% - ${concepto}`, doc, "", 0, round2(f.cuotaIva), cuentaIvaRep, f.archivo));
  }

  // Suplidos
  if (f.suplidos > 0) {
    const cuentaSup = buscarCuenta(plan, "Suplidos") || "554";
    filas.push(fila(num, f.fecha, codigo, `Suplido - ${concepto}`, doc, "", 0, round2(f.suplidos), cuentaSup, f.archivo));
  }

  aplicarAlertas(filas, alertas);
  verificarCuadre(filas);
  return filas;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPRA NORMAL (con IVA español)
// ═══════════════════════════════════════════════════════════════════════
function generarCompraNormal(
  f: FacturaExtraida,
  c: ClienteMaestro,
  plan: CuentaPlan[],
  num: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const alertas = [...f.alertas];
  const tieneIva = f.cuotaIva !== 0;
  const codigo = tieneIva ? obtenerCodigo("compraConIva") : obtenerCodigo("compraSinIva");
  const concepto = formatearConcepto(f, "recibida");
  const doc = formatearDocumento(f);
  const cuentaProv = buscarCuenta(plan, f.emisor, "Proveedor principal", "Proveedor") || "400";

  if (cuentaProv === "400") alertas.push(`Sin subcuenta asignada para "${f.emisor}" — se usa 400 genérica.`);

  // ── Recargo de equivalencia ──
  if (c.recargoEquivalencia && f.cuotaRecargo !== undefined && f.cuotaRecargo !== 0) {
    const cuentaCompras = f.esRectificativa
      ? buscarCuenta(plan, "Devoluciones compras mercancías", "608") || "608"
      : buscarCuenta(plan, "Compras de mercancías", "600") || "600";
    const cuentaRecargoIva = buscarCuenta(plan, "IVA y recargo no deducible", "601") || "601";
    const ivaYRecargo = round2(Math.abs(f.cuotaIva) + Math.abs(f.cuotaRecargo));
    const totalPagar = round2(Math.abs(f.baseImponible) + ivaYRecargo);
    const signo = f.esRectificativa ? -1 : 1;

    filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaCompras, round2(signo * Math.abs(f.baseImponible)), 0, "", f.archivo));
    filas.push(fila(num, f.fecha, codigo, `IVA ${f.tipoIva}% + RE ${f.tipoRecargo}% - ${concepto}`, doc, cuentaRecargoIva, round2(signo * ivaYRecargo), 0, "", f.archivo));
    filas.push(fila(num, f.fecha, codigo, concepto, doc, "", 0, round2(signo * totalPagar), cuentaProv, f.archivo));
    if (f.esRectificativa) alertas.push("Rectificativa en recargo de equivalencia — base a 608, IVA+RE a 601.");
    aplicarAlertas(filas, alertas);
    verificarCuadre(filas);
    return filas;
  }

  // ── Prorrata ──
  let ivaDeducible = Math.abs(f.cuotaIva);
  let ivaNoDeducible = 0;
  if (c.prorrata && tieneIva) {
    const pct = c.porcentajeProrrata / 100;
    ivaDeducible = round2(Math.abs(f.cuotaIva) * pct);
    ivaNoDeducible = round2(Math.abs(f.cuotaIva) - ivaDeducible);
    alertas.push(`Prorrata ${c.porcentajeProrrata}% — ${ivaNoDeducible.toFixed(2)} € de IVA no deducible llevado a gasto.`);
  }

  const cuentaGasto = buscarCuenta(plan, f.emisor, "Gasto general / otros servicios", "Gasto") || "629";
  const gastoBase = round2(Math.abs(f.baseImponible) + ivaNoDeducible);
  const totalPagar = round2(Math.abs(f.baseImponible) + Math.abs(f.cuotaIva) + f.suplidos - f.retencionImporte);
  const signo = f.esRectificativa ? -1 : 1;

  // Gasto (debe) / Proveedor (haber)
  filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaGasto, round2(signo * gastoBase), 0, cuentaProv, f.archivo, undefined));

  // Ajustar haber del proveedor
  filas[0].importeHaber = round2(signo * totalPagar);

  // IVA soportado deducible
  if (ivaDeducible > 0) {
    const cuentaIvaSop = buscarCuenta(plan, "IVA soportado") || "472";
    filas.push(fila(num, f.fecha, codigo, `IVA ${f.tipoIva}% - ${concepto}`, doc, cuentaIvaSop, round2(signo * ivaDeducible), 0, "", f.archivo));
  }

  // Suplidos
  if (f.suplidos > 0) {
    const cuentaSup = buscarCuenta(plan, "Suplidos") || "554";
    filas.push(fila(num, f.fecha, codigo, `Suplido - ${concepto}`, doc, cuentaSup, round2(signo * f.suplidos), 0, "", f.archivo));
  }

  // Retención practicada
  if (f.retencionImporte > 0) {
    const cuentaRetPrac = buscarCuenta(plan, "HP retenciones practicadas") || "4751";
    filas.push(fila(num, f.fecha, codigo, `Retención ${f.retencionPct}% - ${concepto}`, doc, "", 0, round2(signo * f.retencionImporte), cuentaRetPrac, f.archivo));
  }

  aplicarAlertas(filas, alertas);
  verificarCuadre(filas);
  return filas;
}

// ═══════════════════════════════════════════════════════════════════════
// VENTA INTRACOMUNITARIA (exenta, sin IVA español)
// ═══════════════════════════════════════════════════════════════════════
function generarVentaIntracomunitaria(
  f: FacturaExtraida,
  c: ClienteMaestro,
  plan: CuentaPlan[],
  num: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const alertas = [...f.alertas, "Entrega intracomunitaria exenta — verificar NIF intracomunitario del cliente en el 349."];
  const codigo = obtenerCodigo("intracomunitaria");
  const concepto = formatearConcepto(f, "emitida");
  const doc = formatearDocumento(f);
  const cuentaCliente = buscarCuenta(plan, f.receptor, "Cliente principal", "Cliente") || "430";
  const cuentaIngreso = buscarCuenta(plan, "Ingreso por servicios", "Ingreso") || "705";

  // Sin IVA — cargo cliente / abono ingreso directamente
  filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaCliente, round2(f.total), 0, cuentaIngreso, f.archivo));

  aplicarAlertas(filas, alertas);
  verificarCuadre(filas);
  return filas;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPRA INTRACOMUNITARIA (inversión del sujeto pasivo)
// ═══════════════════════════════════════════════════════════════════════
function generarCompraIntracomunitaria(
  f: FacturaExtraida,
  c: ClienteMaestro,
  plan: CuentaPlan[],
  num: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const alertas = [...f.alertas, "Adquisición intracomunitaria — inversión del sujeto pasivo. Incluir en casillas 10/11 del 303 y en el 349."];
  const codigo = obtenerCodigo("intracomunitaria");
  const concepto = formatearConcepto(f, "recibida");
  const doc = formatearDocumento(f);
  const cuentaProv = buscarCuenta(plan, f.emisor, "Proveedor principal", "Proveedor") || "400";
  const cuentaGasto = buscarCuenta(plan, f.emisor, "Gasto general / otros servicios", "Gasto") || "629";
  const cuentaIvaSop = buscarCuenta(plan, "IVA soportado") || "472";
  const cuentaIvaRep = buscarCuenta(plan, "IVA repercutido") || "477";

  // Tipo IVA aplicable en España (el que correspondería si fuera operación interior)
  const tipoIvaEsp = f.tipoIva || 21;
  const cuotaIvaEsp = round2(f.baseImponible * tipoIvaEsp / 100);

  // Gasto (debe) / Proveedor (haber) — sin IVA
  filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaGasto, round2(f.baseImponible), 0, cuentaProv, f.archivo));
  // IVA soportado (debe) — se deduce
  filas.push(fila(num, f.fecha, codigo, `IVA AI ${tipoIvaEsp}% - ${concepto}`, doc, cuentaIvaSop, cuotaIvaEsp, 0, "", f.archivo));
  // IVA repercutido (haber) — inversión sujeto pasivo
  filas.push(fila(num, f.fecha, codigo, `IVA AI ${tipoIvaEsp}% ISP - ${concepto}`, doc, "", 0, cuotaIvaEsp, cuentaIvaRep, f.archivo));

  aplicarAlertas(filas, alertas);
  verificarCuadre(filas);
  return filas;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTACIÓN (venta fuera de la UE, sin IVA)
// ═══════════════════════════════════════════════════════════════════════
function generarExportacion(
  f: FacturaExtraida,
  c: ClienteMaestro,
  plan: CuentaPlan[],
  num: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const alertas = [...f.alertas, "Exportación — exenta art.21 LIVA. Declarar en casilla 60 del 303."];
  const codigo = obtenerCodigo("exportacion");
  const concepto = formatearConcepto(f, "emitida");
  const doc = formatearDocumento(f);
  const cuentaCliente = buscarCuenta(plan, f.receptor, "Cliente principal", "Cliente") || "430";
  const cuentaIngreso = buscarCuenta(plan, "Ingreso por servicios", "Ingreso") || "705";

  filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaCliente, round2(f.total), 0, cuentaIngreso, f.archivo));

  aplicarAlertas(filas, alertas);
  verificarCuadre(filas);
  return filas;
}

// ═══════════════════════════════════════════════════════════════════════
// IMPORTACIÓN (compra fuera de la UE)
// ═══════════════════════════════════════════════════════════════════════
function generarImportacion(
  f: FacturaExtraida,
  c: ClienteMaestro,
  plan: CuentaPlan[],
  num: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const alertas = [...f.alertas, "Importación — verificar DUA de importación. El IVA se liquida en aduana (casilla 32 del 303)."];
  const codigo = obtenerCodigo("compraSinIva");
  const concepto = formatearConcepto(f, "recibida");
  const doc = formatearDocumento(f);
  const cuentaProv = buscarCuenta(plan, f.emisor, "Proveedor principal", "Proveedor") || "400";
  const cuentaGasto = buscarCuenta(plan, f.emisor, "Gasto general / otros servicios", "Gasto") || "629";
  const cuentaIvaSop = buscarCuenta(plan, "IVA soportado") || "472";

  filas.push(fila(num, f.fecha, codigo, concepto, doc, cuentaGasto, round2(f.baseImponible), 0, cuentaProv, f.archivo));
  if (f.cuotaIva > 0) {
    filas.push(fila(num, f.fecha, codigo, `IVA importación - ${concepto}`, doc, cuentaIvaSop, round2(f.cuotaIva), 0, "", f.archivo,
      "IVA de importación — verificar que coincide con el DUA."));
  }

  aplicarAlertas(filas, alertas);
  verificarCuadre(filas);
  return filas;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fila(
  numAsiento: number,
  fecha: string,
  codigoOperacion: string,
  concepto: string,
  documento: string,
  cuentaDebe: string,
  importeDebe: number,
  importeHaber: number,
  cuentaHaber: string,
  origen: string,
  alerta?: string
): LineaAsiento {
  return { numAsiento, fecha, codigoOperacion, concepto, documento, cuentaDebe, importeDebe, importeHaber, cuentaHaber, origen, alerta };
}

function aplicarAlertas(filas: LineaAsiento[], alertas: string[]) {
  if (alertas.length === 0 || filas.length === 0) return;
  const texto = alertas.filter(Boolean).join(" / ");
  if (texto) filas[0].alerta = filas[0].alerta ? filas[0].alerta + " / " + texto : texto;
}

function verificarCuadre(filas: LineaAsiento[]) {
  const debe = round2(filas.reduce((acc, f) => acc + f.importeDebe, 0));
  const haber = round2(filas.reduce((acc, f) => acc + f.importeHaber, 0));
  if (Math.abs(debe - haber) > 0.02) {
    const dif = round2(debe - haber);
    const txt = `Asiento descuadrado (${dif >= 0 ? "+" : ""}${dif.toFixed(2)} €) — revisar.`;
    filas[0].alerta = filas[0].alerta ? filas[0].alerta + " / " + txt : txt;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
