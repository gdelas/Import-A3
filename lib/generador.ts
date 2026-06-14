"use client";

import { generarAsientosFactura } from "./asientos";
import { generarAsientosBanco } from "./banco";
import { exportarAsientos, descargarBlob } from "./excel";
import { leerSesion } from "./sessionStore";
import { LineaAsiento, CuentaPlan, FacturaExtraida } from "./types";
import { MovimientoSesion } from "./sessionStore";

export interface ResultadoGeneracion {
  lineas: LineaAsiento[];
  totalAsientos: number;
  totalFacturas: number;
  totalMovimientos: number;
  alertas: number;
}

/**
 * Convierte una fecha en formato DD/MM/AAAA a número comparable.
 * Devuelve 0 si el formato no es reconocible.
 */
function fechaANumero(fecha: string): number {
  if (!fecha) return 0;
  // DD/MM/AAAA
  const partes = fecha.split("/");
  if (partes.length === 3) {
    const [d, m, a] = partes;
    return Number(a) * 10000 + Number(m) * 100 + Number(d);
  }
  // AAAA-MM-DD
  const partesISO = fecha.split("-");
  if (partesISO.length === 3) {
    const [a, m, d] = partesISO;
    return Number(a) * 10000 + Number(m) * 100 + Number(d);
  }
  return 0;
}

/**
 * Extrae el número de factura como entero para ordenar dentro del mismo día.
 * Si no es numérico puro, usa 0.
 */
function numFacturaAOrden(nf: string): number {
  const soloNumeros = (nf || "").replace(/\D/g, "");
  return soloNumeros ? Number(soloNumeros) : 0;
}

/**
 * Ordena las facturas por:
 * 1. Fecha (ascendente)
 * 2. Tipo: compras (034/061) primero, ventas (01) después
 * 3. Número de factura (ascendente) dentro del mismo día y tipo
 */
function ordenarFacturas(facturas: FacturaExtraida[]): FacturaExtraida[] {
  return [...facturas].sort((a, b) => {
    const fechaA = fechaANumero(a.fecha);
    const fechaB = fechaANumero(b.fecha);
    if (fechaA !== fechaB) return fechaA - fechaB;

    // Dentro del mismo día: compras antes que ventas
    const tipoOrden = (f: FacturaExtraida) =>
      f.tipo === "compra" ? 0 : f.tipo === "venta" ? 1 : 2;
    if (tipoOrden(a) !== tipoOrden(b)) return tipoOrden(a) - tipoOrden(b);

    // Mismo día y tipo: por número de factura
    return numFacturaAOrden(a.numeroFactura) - numFacturaAOrden(b.numeroFactura);
  });
}

/**
 * Ordena los movimientos bancarios por fecha ascendente.
 */
function ordenarMovimientos(movimientos: MovimientoSesion[]): MovimientoSesion[] {
  return [...movimientos].sort((a, b) => fechaANumero(a.fecha) - fechaANumero(b.fecha));
}

/**
 * Genera todos los asientos de la sesión actual en orden cronológico:
 *   1. Facturas ordenadas por fecha → dentro del día: compras → ventas
 *   2. Banco ordenado por fecha
 * Si en un mismo día hay facturas y movimientos de banco, las facturas
 * van primero (compras → ventas) y el banco al final de ese día.
 *
 * @param numInicial número de asiento por el que empezar
 * @param clasificacionesBanco mapa índice → clasificación IA
 */
export function generarYExportar(
  numInicial: number,
  clasificacionesBanco: Record<number, {
    cuenta: string;
    descripcion: string;
    confianza: string;
    alerta: string;
  }>
): ResultadoGeneracion {
  const sesion = leerSesion();
  const cliente = sesion.cliente;
  const planCuentas: CuentaPlan[] = cliente?.planCuentas ?? [];
  const plantillaA3 = cliente?.plantillaA3 ?? [];

  const clienteBase = cliente?.cliente ?? {
    nombre: "", cif: "", actividad: "",
    retencion: "ninguna" as const,
    prorrata: false, porcentajeProrrata: 100,
    recargoEquivalencia: false, criterioCaja: false,
    regimenIva: "general" as const, notas: "",
  };

  // --- Ordenar datos ---
  const facturasOrdenadas = ordenarFacturas(sesion.facturas);
  const movimientosOrdenados = ordenarMovimientos(sesion.movimientos);

  // --- Mezclar por fecha: facturas (compras→ventas) y banco, día a día ---
  // Obtenemos todas las fechas únicas
  const todasFechas = new Set([
    ...facturasOrdenadas.map((f) => f.fecha || "0"),
    ...movimientosOrdenados.map((m) => m.fecha || "0"),
  ]);

  const fechasOrdenadas = Array.from(todasFechas).sort(
    (a, b) => fechaANumero(a) - fechaANumero(b)
  );

  const todasLineas: LineaAsiento[] = [];
  let siguiente = numInicial;

  // Índice de movimientos procesados (para mantener la referencia con clasificaciones)
  let idxMovimiento = 0;
  const mapaClasifMovimiento: Record<number, typeof clasificacionesBanco[number]> = {};

  // Reasignar clasificaciones al nuevo orden
  movimientosOrdenados.forEach((_, i) => {
    // La clasificación viene indexada por posición original (antes de ordenar)
    // Buscamos el movimiento original en la sesión para mapear correctamente
    const idxOriginal = sesion.movimientos.findIndex(
      (m) => m.fecha === movimientosOrdenados[i].fecha &&
              m.concepto === movimientosOrdenados[i].concepto &&
              m.importe === movimientosOrdenados[i].importe
    );
    if (clasificacionesBanco[idxOriginal]) {
      mapaClasifMovimiento[i] = clasificacionesBanco[idxOriginal];
    }
  });

  for (const fecha of fechasOrdenadas) {
    // Facturas de este día (ya vienen ordenadas: compras → ventas → número)
    const facturasDia = facturasOrdenadas.filter((f) => (f.fecha || "0") === fecha);
    for (const factura of facturasDia) {
      const lineas = generarAsientosFactura(factura, clienteBase, planCuentas, siguiente);
      todasLineas.push(...lineas);
      siguiente++;
    }

    // Movimientos bancarios de este día
    const movsDia = movimientosOrdenados
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => (m.fecha || "0") === fecha);

    for (const { m, i } of movsDia) {
      const esIngreso = m.importe >= 0;
      const importe = Math.abs(Math.round((m.importe + Number.EPSILON) * 100) / 100);
      const codigos = typeof window !== "undefined"
        ? ((): string => {
            try {
              const raw = localStorage.getItem("efa_codigos_operacion");
              if (!raw) return "01";
              const parsed = JSON.parse(raw);
              return parsed.find((c: { tipo: string; codigo: string }) => c.tipo === "banco")?.codigo || "01";
            } catch { return "01"; }
          })()
        : "01";
      const cuentaBanco = planCuentas.find((p) =>
        p.concepto.toLowerCase().includes("banco principal") ||
        p.concepto.toLowerCase().includes("banco")
      )?.cuenta || "572";

      // Fila banco (572)
      const filaBanco: LineaAsiento = {
        numAsiento: siguiente,
        fecha: m.fecha,
        codigoOperacion: codigos,
        concepto: m.concepto,
        documento: "",
        cuentaDebe: esIngreso ? cuentaBanco : "",
        importeDebe: esIngreso ? importe : 0,
        importeHaber: esIngreso ? 0 : importe,
        cuentaHaber: esIngreso ? "" : cuentaBanco,
        origen: "Extracto bancario",
      };

      // Fila contrapartida
      const clasif = mapaClasifMovimiento[i];
      let cuentaContra = "";
      let conceptoContra = m.concepto;
      let alertaContra = "Contrapartida sin clasificar — asignar cuenta manualmente";

      if (clasif && clasif.cuenta && clasif.confianza !== "baja") {
        cuentaContra = clasif.cuenta;
        conceptoContra = clasif.descripcion || m.concepto;
        alertaContra = clasif.confianza === "media"
          ? `Revisar — ${clasif.alerta || "verificar cuenta"}`
          : "";
      }

      const filaContra: LineaAsiento = {
        numAsiento: siguiente,
        fecha: m.fecha,
        codigoOperacion: codigos,
        concepto: conceptoContra,
        documento: "",
        cuentaDebe: esIngreso ? "" : cuentaContra,
        importeDebe: esIngreso ? 0 : importe,
        importeHaber: esIngreso ? importe : 0,
        cuentaHaber: esIngreso ? cuentaContra : "",
        origen: "Extracto bancario",
        alerta: alertaContra || undefined,
      };

      todasLineas.push(filaBanco, filaContra);
      siguiente++;
      idxMovimiento++;
    }
  }

  // --- Exportar XLS ---
  const nombreFichero = `asientos_${(cliente?.cliente.nombre || "cliente").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const blob = exportarAsientos(todasLineas, plantillaA3);
  descargarBlob(blob, nombreFichero);

  void idxMovimiento;

  return {
    lineas: todasLineas,
    totalAsientos: new Set(todasLineas.map((l) => l.numAsiento)).size,
    totalFacturas: facturasOrdenadas.length,
    totalMovimientos: movimientosOrdenados.length,
    alertas: todasLineas.filter((l) => l.alerta).length,
  };
}
