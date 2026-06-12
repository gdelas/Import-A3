import { ClienteMaestro, CuentaPlan, FacturaExtraida, LineaAsiento } from "./types";
import { buscarCuenta } from "./excel";
import { leerCodigos } from "./codigos";

function obtenerCodigo(tipo: "venta" | "compraConIva" | "compraSinIva"): string {
  const codigos = typeof window !== "undefined" ? leerCodigos() : [];
  if (tipo === "venta") {
    return codigos.find((c) => c.tipo === "venta")?.codigo || "01";
  }
  if (tipo === "compraConIva") {
    const compras = codigos.filter((c) => c.tipo === "compra");
    return (
      compras.find((c) => !c.descripcion.toLowerCase().includes("sin iva"))?.codigo ||
      compras[0]?.codigo ||
      "034"
    );
  }
  const compras = codigos.filter((c) => c.tipo === "compra");
  return (
    compras.find((c) => c.descripcion.toLowerCase().includes("sin iva"))?.codigo ||
    compras[1]?.codigo ||
    "061"
  );
}

/**
 * Genera las filas de asiento (formato A3: una fila = una partida del
 * asiento, con número de asiento compartido) para una factura ya extraída,
 * aplicando las particularidades del cliente (retención, prorrata, recargo
 * de equivalencia, suplidos...) y las subcuentas de su plan de cuentas.
 *
 * @param numAsiento número de asiento a usar para todas las partidas de esta factura
 */
export function generarAsientosFactura(
  factura: FacturaExtraida,
  cliente: ClienteMaestro,
  planCuentas: CuentaPlan[],
  numAsiento: number
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const documento = factura.numeroFactura || "";
  const origen = factura.archivo;
  const alertas: string[] = [...factura.alertas];

  if (factura.tipo === "venta") {
    const cuentaCliente =
      buscarCuenta(planCuentas, factura.receptor, "Cliente principal", "Cliente") || "430";
    if (cuentaCliente === "430") {
      alertas.push(`Sin subcuenta asignada para "${factura.receptor || "el cliente"}" en el plan de cuentas — se usa 430 genérica.`);
    }
    const cuentaIngreso = buscarCuenta(planCuentas, "Ingreso por servicios", "Ingreso") || "705";
    const concepto = `Fact. nº ${documento || "s/n"} - ${factura.receptor || "cliente"}`;
    const totalCobrar = round2(factura.total - factura.retencionImporte);

    filas.push(fila({
      numAsiento, fecha: factura.fecha, codigo: obtenerCodigo("venta"), concepto, documento,
      cuentaDebe: cuentaCliente, importeDebe: totalCobrar,
      cuentaHaber: cuentaIngreso, importeHaber: round2(factura.baseImponible),
      origen,
    }));

    if (factura.cuotaIva > 0) {
      const cuentaIva = buscarCuenta(planCuentas, "IVA repercutido") || "477";
      filas.push(fila({
        numAsiento, fecha: factura.fecha, codigo: obtenerCodigo("venta"),
        concepto: `IVA repercutido ${factura.tipoIva}% - ${concepto}`, documento,
        cuentaDebe: "", importeDebe: 0,
        cuentaHaber: cuentaIva, importeHaber: round2(factura.cuotaIva),
        origen,
      }));
    } else if (factura.baseImponible > 0) {
      alertas.push("Factura sin IVA — revisar si es exportación, intracomunitaria o exenta.");
    }

    if (factura.retencionImporte > 0) {
      const cuentaRet = buscarCuenta(planCuentas, "HP retenciones soportadas") || "473";
      filas.push(fila({
        numAsiento, fecha: factura.fecha, codigo: obtenerCodigo("venta"),
        concepto: `Retención ${factura.retencionPct}% - ${concepto}`, documento,
        cuentaDebe: cuentaRet, importeDebe: round2(factura.retencionImporte),
        cuentaHaber: "", importeHaber: 0,
        origen,
      }));
    }

    if (factura.suplidos > 0) {
      const cuentaSuplido = buscarCuenta(planCuentas, "Suplidos") || "554";
      filas.push(fila({
        numAsiento, fecha: factura.fecha, codigo: obtenerCodigo("venta"),
        concepto: `Suplido - ${concepto}`, documento,
        cuentaDebe: "", importeDebe: 0,
        cuentaHaber: cuentaSuplido, importeHaber: round2(factura.suplidos),
        origen,
      }));
    }

    aplicarAlertas(filas, alertas);
    verificarCuadre(filas);
    return filas;
  }

  if (factura.tipo === "compra") {
    const cuentaProveedor =
      buscarCuenta(planCuentas, factura.emisor, "Proveedor principal", "Proveedor") || "400";
    if (cuentaProveedor === "400") {
      alertas.push(`Sin subcuenta asignada para "${factura.emisor || "el proveedor"}" en el plan de cuentas — se usa 400 genérica.`);
    }
    const cuentaGasto = buscarCuenta(planCuentas, "Gasto general / otros servicios", "Gasto") || "629";
    const concepto = `Fact. nº ${documento || "s/n"} - ${factura.emisor || "proveedor"}`;
    const tieneIva = factura.cuotaIva > 0;
    const codigo = tieneIva ? obtenerCodigo("compraConIva") : obtenerCodigo("compraSinIva");

    let ivaDeducible = factura.cuotaIva;
    let ivaNoDeducible = 0;

    if (cliente.prorrata && tieneIva) {
      const pct = cliente.porcentajeProrrata / 100;
      ivaDeducible = round2(factura.cuotaIva * pct);
      ivaNoDeducible = round2(factura.cuotaIva - ivaDeducible);
      alertas.push(
        `Prorrata ${cliente.porcentajeProrrata}% aplicada — ${ivaNoDeducible.toFixed(2)} € de IVA no deducible llevado a gasto.`
      );
    }

    if (cliente.recargoEquivalencia && tieneIva) {
      ivaDeducible = 0;
      ivaNoDeducible = factura.cuotaIva;
      alertas.push("Cliente en recargo de equivalencia — IVA no deducible, llevado a gasto.");
    }

    const gastoBase = round2(factura.baseImponible + ivaNoDeducible);
    const totalPagar = round2(
      factura.baseImponible + factura.cuotaIva + factura.suplidos - factura.retencionImporte
    );

    filas.push(fila({
      numAsiento, fecha: factura.fecha, codigo, concepto, documento,
      cuentaDebe: cuentaGasto, importeDebe: gastoBase,
      cuentaHaber: cuentaProveedor, importeHaber: totalPagar,
      origen,
    }));

    if (ivaDeducible > 0) {
      const cuentaIvaSoportado = buscarCuenta(planCuentas, "IVA soportado") || "472";
      filas.push(fila({
        numAsiento, fecha: factura.fecha, codigo,
        concepto: `IVA soportado ${factura.tipoIva}% - ${concepto}`, documento,
        cuentaDebe: cuentaIvaSoportado, importeDebe: ivaDeducible,
        cuentaHaber: "", importeHaber: 0,
        origen,
      }));
      filas[0].importeHaber = totalPagar;
      filas[0].importeDebe = gastoBase;
      filas[1].importeDebe = ivaDeducible;
    }

    if (factura.suplidos > 0) {
      const cuentaSuplido = buscarCuenta(planCuentas, "Suplidos") || "554";
      filas.push(fila({
        numAsiento, fecha: factura.fecha, codigo,
        concepto: `Suplido - ${concepto}`, documento,
        cuentaDebe: cuentaSuplido, importeDebe: round2(factura.suplidos),
        cuentaHaber: "", importeHaber: 0,
        origen,
      }));
    }

    if (factura.retencionImporte > 0) {
      const cuentaRetPracticada = buscarCuenta(planCuentas, "HP retenciones practicadas") || "4751";
      filas.push(fila({
        numAsiento, fecha: factura.fecha, codigo,
        concepto: `Retención ${factura.retencionPct}% practicada - ${concepto}`, documento,
        cuentaDebe: "", importeDebe: 0,
        cuentaHaber: cuentaRetPracticada, importeHaber: round2(factura.retencionImporte),
        origen,
      }));
    }

    aplicarAlertas(filas, alertas);
    verificarCuadre(filas);
    return filas;
  }

  return [
    fila({
      numAsiento, fecha: factura.fecha, codigo: "", concepto: `${origen} — no se ha podido determinar si es venta o compra`,
      documento,
      cuentaDebe: "", importeDebe: factura.total,
      cuentaHaber: "", importeHaber: 0,
      origen,
      alerta: "Revisar manualmente: no se ha podido clasificar la factura como venta o compra.",
    }),
  ];
}

function fila(args: {
  numAsiento: number;
  fecha: string;
  codigo: string;
  concepto: string;
  documento: string;
  cuentaDebe: string;
  importeDebe: number;
  cuentaHaber: string;
  importeHaber: number;
  origen: string;
  alerta?: string;
}): LineaAsiento {
  return {
    numAsiento: args.numAsiento,
    fecha: args.fecha,
    codigoOperacion: args.codigo,
    concepto: args.concepto,
    documento: args.documento,
    cuentaDebe: args.cuentaDebe,
    importeDebe: args.importeDebe,
    importeHaber: args.importeHaber,
    cuentaHaber: args.cuentaHaber,
    origen: args.origen,
    alerta: args.alerta,
  };
}

function aplicarAlertas(filas: LineaAsiento[], alertas: string[]) {
  if (alertas.length === 0 || filas.length === 0) return;
  const texto = alertas.join(" / ");
  filas[0].alerta = filas[0].alerta ? filas[0].alerta + " / " + texto : texto;
}

function verificarCuadre(filas: LineaAsiento[]) {
  const debe = round2(filas.reduce((acc, f) => acc + f.importeDebe, 0));
  const haber = round2(filas.reduce((acc, f) => acc + f.importeHaber, 0));
  if (Math.abs(debe - haber) > 0.01) {
    const diferencia = round2(debe - haber);
    const texto = `Asiento descuadrado (${diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)} €) — revisar.`;
    filas[0].alerta = filas[0].alerta ? filas[0].alerta + " / " + texto : texto;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
