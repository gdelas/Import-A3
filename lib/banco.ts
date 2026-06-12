import * as XLSX from "xlsx";
import { CuentaPlan, LineaAsiento } from "./types";
import { buscarCuenta } from "./excel";
import { leerCodigos } from "./codigos";

export interface MovimientoBancario {
  fecha: string;
  concepto: string;
  importe: number;
  saldo?: number;
}


/**
 * Lee un extracto bancario en XLS/CSV. Intenta detectar automáticamente las
 * columnas de fecha, concepto e importe buscando cabeceras habituales de los
 * bancos españoles (Santander, CaixaBank, BBVA...).
 */
export function leerExtractoBancario(buffer: ArrayBuffer): {
  movimientos: MovimientoBancario[];
  avisos: string[];
} {
  const avisos: string[] = [];
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const posiblesFecha = ["fecha", "fecha valor", "f.valor", "f. valor", "fecha operacion", "fecha operación"];
  const posiblesConcepto = ["concepto", "descripcion", "descripción", "movimiento", "detalle"];
  const posiblesImporte = ["importe", "importe eur", "cantidad", "importe (eur)"];

  let headerRow = -1;
  let colFecha = -1;
  let colConcepto = -1;
  let colImporte = -1;
  let colSaldo = -1;

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r].map((c) => String(c).trim().toLowerCase());
    const fIdx = row.findIndex((c) => posiblesFecha.includes(c));
    const cIdx = row.findIndex((c) => posiblesConcepto.includes(c));
    const iIdx = row.findIndex((c) => posiblesImporte.includes(c));
    if (fIdx >= 0 && cIdx >= 0 && iIdx >= 0) {
      headerRow = r;
      colFecha = fIdx;
      colConcepto = cIdx;
      colImporte = iIdx;
      colSaldo = row.findIndex((c) => c.includes("saldo"));
      break;
    }
  }

  if (headerRow === -1) {
    avisos.push(
      "No se ha podido identificar automáticamente las columnas de fecha, concepto e importe. Revisa el formato del extracto."
    );
    return { movimientos: [], avisos };
  }

  const movimientos: MovimientoBancario[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === "" || c === undefined)) continue;

    const fechaRaw = row[colFecha];
    const concepto = String(row[colConcepto] ?? "").trim();
    const importeRaw = row[colImporte];

    if (fechaRaw === "" && concepto === "" && (importeRaw === "" || importeRaw === undefined)) continue;

    const importe = parseImporte(importeRaw);
    if (importe === null) continue;

    movimientos.push({
      fecha: formatFecha(fechaRaw),
      concepto: concepto || "Movimiento sin concepto",
      importe,
      saldo: colSaldo >= 0 ? parseImporte(row[colSaldo]) ?? undefined : undefined,
    });
  }

  if (movimientos.length === 0) {
    avisos.push("No se han encontrado movimientos por debajo de la cabecera detectada.");
  }

  return { movimientos, avisos };
}

/**
 * Genera filas de asiento de tesorería (formato A3 de 9 columnas) a partir
 * de los movimientos bancarios. La cuenta de banco se coloca en debe o haber
 * según el signo del movimiento; la contrapartida queda sin asignar para
 * revisión manual.
 */
export function generarAsientosBanco(
  movimientos: MovimientoBancario[],
  numAsientoInicial: number,
  planCuentas: CuentaPlan[] = []
): LineaAsiento[] {
  const filas: LineaAsiento[] = [];
  const cuentaBanco = buscarCuenta(planCuentas, "Banco principal", "Banco") || "572";
  const codigos = typeof window !== "undefined" ? leerCodigos() : [];
  const codigoBanco = codigos.find((c) => c.tipo === "banco")?.codigo || "01";

  movimientos.forEach((m, i) => {
    const esIngreso = m.importe >= 0;
    const importe = Math.abs(round2(m.importe));
    const numAsiento = numAsientoInicial + i;

    filas.push({
      numAsiento,
      fecha: m.fecha,
      codigoOperacion: codigoBanco,
      concepto: m.concepto,
      documento: "",
      cuentaDebe: esIngreso ? cuentaBanco : "",
      importeDebe: esIngreso ? importe : 0,
      cuentaHaber: esIngreso ? "" : cuentaBanco,
      importeHaber: esIngreso ? 0 : importe,
      origen: "Extracto bancario",
      alerta: "Contrapartida sin clasificar — asignar cuenta según el concepto del movimiento.",
    });

    // Completar la contrapartida en la misma fila (cuenta vacía)
    const fila = filas[filas.length - 1];
    if (esIngreso) {
      fila.cuentaHaber = "";
    } else {
      fila.cuentaDebe = "";
    }
  });

  return filas;
}

function parseImporte(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  const limpio = raw
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3},)/g, "")
    .replace(",", ".");
  const n = Number(limpio);
  return Number.isNaN(n) ? null : n;
}

function formatFecha(raw: string | number | undefined): string {
  if (raw === undefined || raw === "") return "";
  if (typeof raw === "number") {
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) {
      const dd = String(date.d).padStart(2, "0");
      const mm = String(date.m).padStart(2, "0");
      return `${dd}/${mm}/${date.y}`;
    }
  }
  return String(raw).trim();
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
