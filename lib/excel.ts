import * as XLSX from "xlsx";
import {
  ClienteMaestro,
  ColumnaPlantillaA3,
  CuentaPlan,
  LineaAsiento,
  PLACEHOLDER_CLIENTE,
  PLAN_CUENTAS_BASE,
  PLANTILLA_A3_BASE,
} from "./types";

const HEADER_FILL = { fgColor: { rgb: "FF0B6E4F" } };
const HEADER_FONT = { color: { rgb: "FFFFFFFF" }, bold: true };
const ALT_FILL = { fgColor: { rgb: "FFE3F1EA" } };

/**
 * Lee el fichero XLS del cliente con la estructura estándar de 3 hojas:
 * 1. "Cliente"     — pares clave / valor con datos fiscales y particularidades.
 * 2. "PlanCuentas" — tabla "Concepto" / "Cuenta" con las subcuentas asignadas.
 * 3. "PlantillaA3" — cabecera con el nombre de cada columna de importación A3.
 */
export function leerFicheroCliente(buffer: ArrayBuffer): {
  cliente: ClienteMaestro;
  planCuentas: CuentaPlan[];
  plantillaA3: ColumnaPlantillaA3[];
  avisos: string[];
} {
  const avisos: string[] = [];
  const wb = XLSX.read(buffer, { type: "array" });

  const hojaCliente = encontrarHoja(wb, ["cliente", "datos"]);
  const hojaPlan = encontrarHoja(wb, ["plancuentas", "plan de cuentas", "cuentas"]);
  const hojaPlantilla = encontrarHoja(wb, ["plantillaa3", "plantilla a3", "a3"]);

  const cliente: ClienteMaestro = { ...PLACEHOLDER_CLIENTE };

  if (hojaCliente) {
    const sheet = wb.Sheets[hojaCliente];
    const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    const map: Record<string, string> = {};
    for (const row of rows) {
      const clave = String(row[0] ?? "").trim().toLowerCase();
      const valor = String(row[1] ?? "").trim();
      if (clave) map[clave] = valor;
    }

    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (map[k] !== undefined && map[k] !== "") return map[k];
      }
      return "";
    };

    cliente.nombre = get("nombre", "cliente", "razon social", "razón social");
    cliente.cif = get("cif", "nif");
    cliente.actividad = get("actividad", "negocio", "actividad economica", "actividad económica");

    const ret = get("retencion", "retención", "tipo retencion", "tipo retención").replace("%", "").trim();
    cliente.retencion = ["7", "15", "19", "35"].includes(ret) ? (ret as ClienteMaestro["retencion"]) : "ninguna";

    const prorrataVal = get("prorrata", "tiene prorrata").toLowerCase();
    cliente.prorrata = ["si", "sí", "true", "1", "yes"].includes(prorrataVal);

    const pctProrrata = get("porcentaje prorrata", "% prorrata", "prorrata %");
    cliente.porcentajeProrrata = pctProrrata ? Number(pctProrrata.replace("%", "")) : 100;

    cliente.recargoEquivalencia = ["si", "sí", "true", "1", "yes"].includes(
      get("recargo equivalencia", "recargo de equivalencia").toLowerCase()
    );
    cliente.criterioCaja = ["si", "sí", "true", "1", "yes"].includes(
      get("criterio de caja", "criterio caja").toLowerCase()
    );

    const regimen = get("regimen iva", "régimen iva", "régimen de iva").toLowerCase();
    if (["general", "simplificado", "exento", "recc"].includes(regimen)) {
      cliente.regimenIva = regimen as ClienteMaestro["regimenIva"];
    }

    cliente.notas = get("notas", "observaciones");

    if (!cliente.nombre) {
      avisos.push("No se ha encontrado el campo 'Nombre' en la hoja Cliente.");
    }
  } else {
    avisos.push("El fichero no contiene una hoja 'Cliente' con los datos fiscales.");
  }

  let planCuentas: CuentaPlan[] = [];
  if (hojaPlan) {
    const sheet = wb.Sheets[hojaPlan];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    planCuentas = rows
      .map((r) => {
        const concepto = String(r["Concepto"] ?? r["concepto"] ?? "").trim();
        const cuenta = String(r["Cuenta"] ?? r["cuenta"] ?? r["Subcuenta"] ?? r["subcuenta"] ?? "").trim();
        const notas = String(r["Notas"] ?? r["notas"] ?? "").trim();
        return { concepto, cuenta, notas: notas || undefined };
      })
      .filter((r) => r.concepto !== "");

    if (planCuentas.length === 0) {
      avisos.push("La hoja de plan de cuentas no tiene filas con 'Concepto' y 'Cuenta'.");
    }
  } else {
    avisos.push("El fichero no contiene una hoja 'PlanCuentas' con las subcuentas asignadas.");
  }

  let plantillaA3: ColumnaPlantillaA3[] = [];
  if (hojaPlantilla) {
    const sheet = wb.Sheets[hojaPlantilla];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const cabecera = rows[0] || [];
    plantillaA3 = cabecera
      .map((campo, i) => ({ letra: XLSX.utils.encode_col(i), campo: String(campo).trim() }))
      .filter((c) => c.campo !== "");

    if (plantillaA3.length === 0) {
      avisos.push("La hoja 'PlantillaA3' no tiene cabecera con el formato de columnas.");
    } else if (plantillaA3.length !== 9) {
      avisos.push(
        `La hoja 'PlantillaA3' tiene ${plantillaA3.length} columnas — se esperan 9. Se usará el formato estándar al exportar.`
      );
    }
  } else {
    avisos.push("El fichero no contiene una hoja 'PlantillaA3' con el formato de importación.");
    plantillaA3 = PLANTILLA_A3_BASE;
  }

  return { cliente, planCuentas, plantillaA3, avisos };
}

function encontrarHoja(wb: XLSX.WorkBook, nombres: string[]): string | undefined {
  return wb.SheetNames.find((n) => nombres.includes(n.trim().toLowerCase()));
}

/**
 * Busca en el plan de cuentas del cliente la subcuenta asignada a un
 * concepto dado. Coincidencia flexible: ignora mayúsculas/acentos y permite
 * coincidencia parcial.
 */
export function buscarCuenta(planCuentas: CuentaPlan[], ...conceptos: string[]): string {
  const normaliza = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  for (const concepto of conceptos) {
    const objetivo = normaliza(concepto);
    const exacto = planCuentas.find((c) => normaliza(c.concepto) === objetivo);
    if (exacto?.cuenta) return exacto.cuenta;
  }
  for (const concepto of conceptos) {
    const objetivo = normaliza(concepto);
    const parcial = planCuentas.find(
      (c) => normaliza(c.concepto).includes(objetivo) || objetivo.includes(normaliza(c.concepto))
    );
    if (parcial?.cuenta) return parcial.cuenta;
  }
  return "";
}

/**
 * Genera un XLS de ejemplo con la estructura estándar de 3 hojas, con
 * formato visual (cabeceras en verde, columnas anchas) listo para rellenar.
 */
export function generarPlantillaEjemplo(): Blob {
  const wb = XLSX.utils.book_new();

  // Hoja 1 — Cliente
  const datosCliente = [
    ["Campo", "Valor"],
    ["Nombre", "Barros Mercantil 2021 S.L."],
    ["CIF", "B42897009"],
    ["Actividad", "Compraventa y arrendamiento de inmovilizado"],
    ["Retención", "15"],
    ["Prorrata", "No"],
    ["Porcentaje prorrata", "100"],
    ["Recargo equivalencia", "No"],
    ["Criterio de caja", "No"],
    ["Régimen IVA", "general"],
    ["Notas", "Cliente de ejemplo para pruebas"],
  ];
  const wsCliente = XLSX.utils.aoa_to_sheet(datosCliente);
  wsCliente["!cols"] = [{ wch: 22 }, { wch: 42 }];
  estiloCabecera(wsCliente, 1);
  XLSX.utils.book_append_sheet(wb, wsCliente, "Cliente");

  // Hoja 2 — Plan de cuentas
  const planRows = [
    ["Concepto", "Cuenta", "Notas"],
    ...PLAN_CUENTAS_BASE.map((c) => [c.concepto, c.cuenta, c.notas ?? ""]),
    ["Cliente — Barros Labradores S.L.", "43000720", "Subcuenta asignada en A3"],
    ["Proveedor — Dogma Abogados", "41000041", "Subcuenta asignada en A3"],
  ];
  const wsPlan = XLSX.utils.aoa_to_sheet(planRows);
  wsPlan["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 32 }];
  estiloCabecera(wsPlan, 3);
  XLSX.utils.book_append_sheet(wb, wsPlan, "PlanCuentas");

  // Hoja 3 — Plantilla A3
  const plantillaRows = [PLANTILLA_A3_BASE.map((c) => c.campo)];
  const wsPlantilla = XLSX.utils.aoa_to_sheet(plantillaRows);
  wsPlantilla["!cols"] = PLANTILLA_A3_BASE.map((c) => ({
    wch: c.campo.toLowerCase().includes("concepto") ? 30 : 16,
  }));
  estiloCabecera(wsPlantilla, PLANTILLA_A3_BASE.length);
  XLSX.utils.book_append_sheet(wb, wsPlantilla, "PlantillaA3");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
  return new Blob([out], { type: "application/octet-stream" });
}

function estiloCabecera(ws: XLSX.WorkSheet, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { fill: HEADER_FILL, font: HEADER_FONT };
  }
}

/**
 * Exporta las filas de asiento generadas en el formato fijo de 9 columnas
 * acordado para A3:
 * Num asiento | Fecha | Código | Concepto | Documento | Cuenta debe |
 * Importe debe | Importe haber | Cuenta haber
 */
export function exportarAsientos(
  lineas: LineaAsiento[],
  plantillaA3: ColumnaPlantillaA3[]
): Blob {
  const campos = plantillaA3.length === 9 ? plantillaA3.map((c) => c.campo) : PLANTILLA_A3_BASE.map((c) => c.campo);
  const normaliza = (campo: string) => campo.trim().toLowerCase();

  const filas = lineas.map((l) => {
    const fila: Record<string, string | number> = {};
    for (const campo of campos) {
      const c = normaliza(campo);
      if (c.includes("asiento") || c.includes("num")) fila[campo] = l.numAsiento;
      else if (c.includes("fecha")) fila[campo] = l.fecha;
      else if (c.includes("codigo") || c.includes("código")) fila[campo] = l.codigoOperacion;
      else if (c.includes("concepto") || c.includes("descripcion") || c.includes("descripción")) fila[campo] = l.concepto;
      else if (c.includes("documento")) fila[campo] = l.documento;
      else if (c.includes("debe") && c.includes("cuenta")) fila[campo] = l.cuentaDebe;
      else if (c.includes("debe")) fila[campo] = l.importeDebe || "";
      else if (c.includes("haber") && c.includes("cuenta")) fila[campo] = l.cuentaHaber;
      else if (c.includes("haber")) fila[campo] = l.importeHaber || "";
      else fila[campo] = "";
    }
    if (l.alerta) fila["Aviso"] = l.alerta;
    return fila;
  });

  const camposConAviso = lineas.some((l) => l.alerta) ? [...campos, "Aviso"] : campos;

  const ws = XLSX.utils.json_to_sheet(filas, { header: camposConAviso });
  ws["!cols"] = camposConAviso.map((c) => ({ wch: normaliza(c).includes("concepto") ? 32 : 16 }));
  estiloCabecera(ws, camposConAviso.length);

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 1; r <= range.e.r; r++) {
    const linea = lineas[r - 1];
    if (linea?.alerta) {
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = { fill: ALT_FILL };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asientos");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
  return new Blob([out], { type: "application/octet-stream" });
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
