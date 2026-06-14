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

// ─── Estilos ────────────────────────────────────────────────────────────────
const S = {
  headerVerde: { fill: { fgColor: { rgb: "FF0B6E4F" } }, font: { color: { rgb: "FFFFFFFF" }, bold: true, sz: 11 }, alignment: { vertical: "center" } },
  headerGris: { fill: { fgColor: { rgb: "FF4A5750" } }, font: { color: { rgb: "FFFFFFFF" }, bold: true, sz: 11 } },
  seccion: { fill: { fgColor: { rgb: "FFE3F1EA" } }, font: { bold: true, color: { rgb: "FF064A35" }, sz: 10 }, alignment: { horizontal: "left" } },
  campo: { font: { color: { rgb: "FF51635A" }, sz: 10 } },
  valor: { font: { sz: 10 } },
  instruccion: { font: { italic: true, color: { rgb: "FF888888" }, sz: 9 } },
  alerta: { fill: { fgColor: { rgb: "FFFFF3CD" } }, font: { color: { rgb: "FF856404" }, sz: 9 } },
  altVerde: { fill: { fgColor: { rgb: "FFF0F7F3" } } },
};

function cell(v: string | number, s?: object): XLSX.CellObject {
  return { v, t: typeof v === "number" ? "n" : "s", s } as XLSX.CellObject;
}

// ─── LEER fichero del cliente ────────────────────────────────────────────────
export function leerFicheroCliente(buffer: ArrayBuffer): {
  cliente: ClienteMaestro;
  planCuentas: CuentaPlan[];
  plantillaA3: ColumnaPlantillaA3[];
  avisos: string[];
} {
  const avisos: string[] = [];
  const wb = XLSX.read(buffer, { type: "array" });

  const hojaCliente = encontrarHoja(wb, ["cliente", "datos"]);
  const hojaPlan = encontrarHoja(wb, ["plancuentas", "plan de cuentas", "cuentas", "plan"]);
  const hojaPlantilla = encontrarHoja(wb, ["plantillaa3", "plantilla a3", "a3", "plantilla"]);

  const cliente: ClienteMaestro = { ...PLACEHOLDER_CLIENTE };

  // ── Hoja Cliente ──
  if (hojaCliente) {
    const sheet = wb.Sheets[hojaCliente];
    const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const map: Record<string, string> = {};
    for (const row of rows) {
      const clave = String(row[0] ?? "").trim().toLowerCase().replace(/[*:]/g, "").trim();
      const valor = String(row[1] ?? "").trim();
      if (clave && valor) map[clave] = valor;
    }

    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = map[k.toLowerCase()];
        if (v !== undefined && v !== "") return v;
      }
      return "";
    };

    cliente.nombre = get("nombre", "razon social", "razón social", "cliente");
    cliente.cif = get("cif", "nif");
    cliente.actividad = get("actividad", "negocio", "actividad economica", "actividad económica");

    const ret = get("retencion", "retención", "tipo retencion", "tipo retención").replace("%", "").trim();
    cliente.retencion = ["7", "15", "19", "35"].includes(ret) ? ret as ClienteMaestro["retencion"] : "ninguna";

    const prorrataVal = get("prorrata").toLowerCase();
    cliente.prorrata = ["si", "sí", "true", "1", "yes"].includes(prorrataVal);

    if (cliente.prorrata) {
      const pct = get("porcentaje prorrata", "% prorrata", "prorrata %", "porcentaje de prorrata");
      const pctNum = Number(pct.replace("%", "").trim());
      if (!pct || isNaN(pctNum) || pctNum <= 0 || pctNum >= 100) {
        avisos.push("⚠ Prorrata marcada como Sí pero el porcentaje no está definido o es inválido. Revisa el campo 'Porcentaje prorrata' en la hoja Cliente.");
        cliente.porcentajeProrrata = 100; // sin efecto hasta que se corrija
        cliente.prorrata = false; // desactivar para no aplicar sin porcentaje
      } else {
        cliente.porcentajeProrrata = pctNum;
      }
    }

    const recargoVal = get("recargo equivalencia", "recargo de equivalencia").toLowerCase();
    cliente.recargoEquivalencia = ["si", "sí", "true", "1", "yes"].includes(recargoVal);

    const cajaVal = get("criterio de caja", "criterio caja").toLowerCase();
    cliente.criterioCaja = ["si", "sí", "true", "1", "yes"].includes(cajaVal);

    const regimen = get("regimen iva", "régimen iva", "régimen de iva").toLowerCase();
    if (["general", "simplificado", "exento", "recc"].includes(regimen)) {
      cliente.regimenIva = regimen as ClienteMaestro["regimenIva"];
    }

    cliente.notas = get("notas", "observaciones");

    if (!cliente.nombre) avisos.push("No se ha encontrado el campo 'Nombre' en la hoja Cliente.");
    if (!cliente.cif) avisos.push("No se ha encontrado el campo 'CIF/NIF' en la hoja Cliente.");
  } else {
    avisos.push("El fichero no contiene una hoja 'Cliente' con los datos fiscales.");
  }

  // ── Hoja Plan de cuentas ──
  let planCuentas: CuentaPlan[] = [];
  if (hojaPlan) {
    const sheet = wb.Sheets[hojaPlan];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    planCuentas = rows
      .map((r) => ({
        concepto: String(r["Concepto"] ?? r["concepto"] ?? "").trim(),
        cuenta: String(r["Cuenta"] ?? r["cuenta"] ?? r["Subcuenta"] ?? r["subcuenta"] ?? "").trim(),
        notas: String(r["Notas"] ?? r["notas"] ?? "").trim() || undefined,
      }))
      .filter((r) => r.concepto !== "" && !r.concepto.startsWith("→"));

    const sinCuenta = planCuentas.filter((c) => !c.cuenta).length;
    if (sinCuenta > 0) {
      avisos.push(`${sinCuenta} concepto(s) del plan de cuentas sin subcuenta asignada — los asientos correspondientes usarán cuentas genéricas del PGC.`);
    }
    if (planCuentas.length === 0) {
      avisos.push("La hoja PlanCuentas no tiene filas válidas.");
    }
  } else {
    avisos.push("El fichero no contiene una hoja 'PlanCuentas'. Los asientos usarán cuentas genéricas del PGC.");
  }

  // ── Hoja Plantilla A3 ──
  let plantillaA3: ColumnaPlantillaA3[] = [];
  if (hojaPlantilla) {
    const sheet = wb.Sheets[hojaPlantilla];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const cabecera = rows[0] || [];
    plantillaA3 = cabecera
      .map((campo, i) => ({ letra: XLSX.utils.encode_col(i), campo: String(campo).trim() }))
      .filter((c) => c.campo !== "" && !c.campo.startsWith("→"));

    if (plantillaA3.length !== 9) {
      avisos.push(`La hoja PlantillaA3 tiene ${plantillaA3.length} columnas — se esperan 9. Se usará el formato estándar al exportar.`);
      plantillaA3 = PLANTILLA_A3_BASE;
    }
  } else {
    avisos.push("No se encontró la hoja 'PlantillaA3'. Se usará el formato estándar de 9 columnas.");
    plantillaA3 = PLANTILLA_A3_BASE;
  }

  return { cliente, planCuentas, plantillaA3, avisos };
}

function encontrarHoja(wb: XLSX.WorkBook, nombres: string[]): string | undefined {
  return wb.SheetNames.find((n) => nombres.includes(n.trim().toLowerCase()));
}

export function buscarCuenta(planCuentas: CuentaPlan[], ...conceptos: string[]): string {
  const normaliza = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const concepto of conceptos) {
    const obj = normaliza(concepto);
    const exacto = planCuentas.find((c) => normaliza(c.concepto) === obj);
    if (exacto?.cuenta) return exacto.cuenta;
  }
  for (const concepto of conceptos) {
    const obj = normaliza(concepto);
    const parcial = planCuentas.find(
      (c) => normaliza(c.concepto).includes(obj) || obj.includes(normaliza(c.concepto))
    );
    if (parcial?.cuenta) return parcial.cuenta;
  }
  return "";
}

// ─── GENERAR plantilla de ejemplo ────────────────────────────────────────────
export function generarPlantillaEjemplo(): Blob {
  const wb = XLSX.utils.book_new();

  // Estilos específicos para la plantilla
  const verde     = { fill: { fgColor: { rgb: "FF0B6E4F" } }, font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 }, alignment: { vertical: "center", horizontal: "center" } };
  const verdeOsc  = { fill: { fgColor: { rgb: "FF064A35" } }, font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 10 } };
  const seccion   = { fill: { fgColor: { rgb: "FFD0E8DA" } }, font: { bold: true, color: { rgb: "FF064A35" }, sz: 10 } };
  const labelCell = { fill: { fgColor: { rgb: "FFF4F6F4" } }, font: { bold: true, color: { rgb: "FF15241C" }, sz: 10 }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } }, right: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const valorCell = { fill: { fgColor: { rgb: "FFFFFFFF" } }, font: { color: { rgb: "FF0B6E4F" }, sz: 10, bold: true }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } }, right: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const ayudaCell = { fill: { fgColor: { rgb: "FFFFFDF5" } }, font: { italic: true, color: { rgb: "FF888888" }, sz: 9 }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const alertaCell= { fill: { fgColor: { rgb: "FFFFF3CD" } }, font: { color: { rgb: "FF856404" }, sz: 9, italic: true } };
  const planLabel = { fill: { fgColor: { rgb: "FFF4F6F4" } }, font: { color: { rgb: "FF15241C" }, sz: 10 }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const planValor = { fill: { fgColor: { rgb: "FFFFFFFF" } }, font: { bold: true, color: { rgb: "FF0B6E4F" }, sz: 10 }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const planAlt   = { fill: { fgColor: { rgb: "FFE3F1EA" } }, font: { color: { rgb: "FF15241C" }, sz: 10 }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const planAltV  = { fill: { fgColor: { rgb: "FFE3F1EA" } }, font: { bold: true, color: { rgb: "FF0B6E4F" }, sz: 10 }, border: { bottom: { style: "thin", color: { rgb: "FFD5DED8" } } } };
  const vacio     = { fill: { fgColor: { rgb: "FFFFFFCC" } }, font: { color: { rgb: "FFCCCCCC" }, sz: 9, italic: true } };

  const set = (ws: XLSX.WorkSheet, r: number, c: number, v: string | number, s?: object) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    ws[addr] = { v, t: typeof v === "number" ? "n" : "s", s } as XLSX.CellObject;
  };

  // ══════════════════════════════════════════════════════════
  // HOJA 1 — CLIENTE
  // ══════════════════════════════════════════════════════════
  const wsCli = XLSX.utils.aoa_to_sheet([]);

  // Fila 0 — título
  set(wsCli, 0, 0, "MAESTRO DEL CLIENTE", verde);
  set(wsCli, 0, 1, "VALOR A RELLENAR", verde);
  set(wsCli, 0, 2, "VALORES ACEPTADOS / INSTRUCCIONES", verde);

  // Filas de datos
  // Formato: [label, valorEjemplo, ayuda, esSeccion?]
  type Fila = [string, string, string, true?];
  const filasCliente: Fila[] = [
    ["IDENTIFICACIÓN", "", "", true],
    ["Nombre / Razón social", "Barros Mercantil 2021 S.L.", "Nombre completo de la empresa tal como aparece en sus facturas"],
    ["CIF / NIF", "B42897009", "Sin espacios ni guiones — ej: B42897009 o 28826395N"],
    ["Actividad económica", "Compraventa de inmovilizado", "Descripción breve de la actividad principal"],

    ["IVA", "", "", true],
    ["Régimen de IVA", "general", "Escribe exactamente uno de estos: general · simplificado · exento · recc"],
    ["¿Aplica prorrata?", "No", "Escribe: Sí  o  No"],
    ["Porcentaje IVA deducible (prorrata)", "", "Solo si prorrata = Sí. Escribe un número entero entre 1 y 99. Ejemplo: 80 significa que deduce el 80% del IVA soportado. Si prorrata = No, deja esta celda vacía."],
    ["¿Recargo de equivalencia?", "No", "Escribe: Sí  o  No. Si es Sí, el IVA soportado no se deduce — va a gasto."],
    ["¿Criterio de caja?", "No", "Escribe: Sí  o  No"],

    ["IRPF — RETENCIONES", "", "", true],
    ["Tipo de retención habitual", "15", "Escribe solo el número (sin %). Valores posibles: ninguna · 7 · 15 · 19 · 35. Ejemplo: 15 para el tipo general de profesionales."],

    ["OTROS", "", "", true],
    ["Notas", "", "Campo libre para observaciones sobre este cliente"],
  ];

  let r = 1;
  for (const [label, valor, ayuda, esSeccion] of filasCliente) {
    if (esSeccion) {
      set(wsCli, r, 0, `  ${label}`, seccion);
      set(wsCli, r, 1, "", seccion);
      set(wsCli, r, 2, "", seccion);
    } else {
      set(wsCli, r, 0, label, labelCell);
      set(wsCli, r, 1, valor || "← escribe aquí", valor ? valorCell : vacio);
      set(wsCli, r, 2, ayuda, ayudaCell);
    }
    r++;
  }

  // Nota final
  set(wsCli, r + 1, 0, "IMPORTANTE: No cambies los textos de la columna A (nombres de campo). Solo modifica la columna B (valores).", alertaCell);

  wsCli["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r + 2, c: 2 } });
  wsCli["!cols"] = [{ wch: 38 }, { wch: 32 }, { wch: 75 }];
  wsCli["!rows"] = [{ hpt: 22 }];
  XLSX.utils.book_append_sheet(wb, wsCli, "Cliente");

  // ══════════════════════════════════════════════════════════
  // HOJA 2 — PLAN DE CUENTAS
  // ══════════════════════════════════════════════════════════
  const wsPlan = XLSX.utils.aoa_to_sheet([]);

  // Cabecera
  set(wsPlan, 0, 0, "CONCEPTO", verde);
  set(wsPlan, 0, 1, "SUBCUENTA EN A3", verde);
  set(wsPlan, 0, 2, "DESCRIPCIÓN / NOTAS", verde);

  // Instrucción
  set(wsPlan, 1, 0, "Rellena la columna SUBCUENTA EN A3 con el código exacto que tiene ese concepto en tu A3. Puedes añadir filas al final para más clientes o proveedores.", alertaCell);
  set(wsPlan, 1, 1, "", alertaCell);
  set(wsPlan, 1, 2, "", alertaCell);

  type FilaPlan = { concepto: string; cuenta: string; notas: string; seccion?: boolean };
  const filasPlan: FilaPlan[] = [
    { concepto: "CLIENTES (añade una fila por cada cliente)", cuenta: "", notas: "", seccion: true },
    { concepto: "Cliente — Barros Labradores S.L.", cuenta: "43000720", notas: "Ejemplo: subcuenta específica de este cliente en A3" },
    { concepto: "Cliente — (nombre del cliente)", cuenta: "", notas: "← Añade el nombre del cliente y su subcuenta" },
    { concepto: "Cliente — (nombre del cliente)", cuenta: "", notas: "← Añade más filas si es necesario" },

    { concepto: "PROVEEDORES (añade una fila por cada proveedor)", cuenta: "", notas: "", seccion: true },
    { concepto: "Proveedor — Dogma Abogados", cuenta: "41000041", notas: "Ejemplo: subcuenta específica de este proveedor en A3" },
    { concepto: "Proveedor — (nombre del proveedor)", cuenta: "", notas: "← Añade el nombre del proveedor y su subcuenta" },
    { concepto: "Proveedor — (nombre del proveedor)", cuenta: "", notas: "← Añade más filas si es necesario" },

    { concepto: "CUENTAS BANCARIAS", cuenta: "", notas: "", seccion: true },
    { concepto: "Banco principal", cuenta: "572", notas: "Cuenta bancaria principal. Si hay más de un banco, añade filas." },
    { concepto: "Caja", cuenta: "570", notas: "Solo si opera en efectivo" },

    { concepto: "INGRESOS", cuenta: "", notas: "", seccion: true },
    { concepto: "Ingreso por servicios", cuenta: "705", notas: "Cuenta habitual de ventas / prestación de servicios" },
    { concepto: "Ingreso por ventas de mercaderías", cuenta: "700", notas: "Si vende productos físicos" },

    { concepto: "GASTOS HABITUALES", cuenta: "", notas: "", seccion: true },
    { concepto: "Gasto general / otros servicios", cuenta: "629", notas: "Cuenta comodín para gastos no clasificados" },
    { concepto: "Arrendamientos", cuenta: "621", notas: "Alquiler de local, nave, oficina..." },
    { concepto: "Suministros", cuenta: "628", notas: "Luz, agua, gas, teléfono, internet" },
    { concepto: "Servicios profesionales", cuenta: "623", notas: "Abogados, asesores, consultores. Requieren retención 15%" },
    { concepto: "Seguros", cuenta: "625", notas: "" },
    { concepto: "Servicios bancarios", cuenta: "626", notas: "Comisiones y mantenimiento de cuentas" },
    { concepto: "Publicidad", cuenta: "627", notas: "" },
    { concepto: "Gastos de personal (nóminas)", cuenta: "640", notas: "" },
    { concepto: "Gastos financieros (intereses préstamos)", cuenta: "662", notas: "" },

    { concepto: "CUENTAS FISCALES", cuenta: "", notas: "", seccion: true },
    { concepto: "IVA soportado", cuenta: "472", notas: "IVA de compras deducible" },
    { concepto: "IVA repercutido", cuenta: "477", notas: "IVA de ventas" },
    { concepto: "HP retenciones soportadas", cuenta: "473", notas: "Retenciones que nos practican a nosotros" },
    { concepto: "HP retenciones practicadas", cuenta: "4751", notas: "Retenciones que practicamos a terceros (mod 111/115)" },
    { concepto: "Suplidos", cuenta: "554", notas: "Pagos por cuenta del cliente (tasas, registros...)" },
  ];

  let rp = 2;
  let alterno = false;
  for (const fila of filasPlan) {
    if (fila.seccion) {
      set(wsPlan, rp, 0, `  ${fila.concepto}`, seccion);
      set(wsPlan, rp, 1, "", seccion);
      set(wsPlan, rp, 2, "", seccion);
      alterno = false;
    } else {
      const lStyle = alterno ? planAlt : planLabel;
      const vStyle = alterno ? planAltV : (fila.cuenta ? planValor : vacio);
      set(wsPlan, rp, 0, fila.concepto, lStyle);
      set(wsPlan, rp, 1, fila.cuenta || "← subcuenta A3", vStyle);
      set(wsPlan, rp, 2, fila.notas, alterno ? { ...planAlt, ...ayudaCell } : ayudaCell);
      alterno = !alterno;
    }
    rp++;
  }

  set(wsPlan, rp + 1, 0, "IMPORTANTE: No elimines filas existentes. Rellena solo la columna SUBCUENTA EN A3. Añade filas al final para más clientes o proveedores.", alertaCell);

  wsPlan["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rp + 2, c: 2 } });
  wsPlan["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsPlan, "PlanCuentas");

  // ══════════════════════════════════════════════════════════
  // HOJA 3 — PLANTILLA A3
  // ══════════════════════════════════════════════════════════
  const wsA3 = XLSX.utils.aoa_to_sheet([]);

  // Instrucciones
  set(wsA3, 0, 0, "PLANTILLA DE IMPORTACIÓN A3", verde);
  set(wsA3, 1, 0, "Instrucción 1:", verdeOsc);
  set(wsA3, 1, 1, "La fila 5 de esta hoja define los nombres de las 9 columnas de tu plantilla de importación en A3.", ayudaCell);
  set(wsA3, 2, 0, "Instrucción 2:", verdeOsc);
  set(wsA3, 2, 1, "Si en tu versión de A3 las columnas tienen nombres diferentes, modifica solo la fila 5. El orden debe ser el mismo.", ayudaCell);
  set(wsA3, 3, 0, "Instrucción 3:", verdeOsc);
  set(wsA3, 3, 1, "No añadas ni quites columnas — siempre deben ser exactamente 9.", ayudaCell);

  // Cabecera de las 9 columnas
  set(wsA3, 4, 0, "A", seccion);
  set(wsA3, 4, 1, "B", seccion);
  set(wsA3, 4, 2, "C", seccion);
  set(wsA3, 4, 3, "D", seccion);
  set(wsA3, 4, 4, "E", seccion);
  set(wsA3, 4, 5, "F", seccion);
  set(wsA3, 4, 6, "G", seccion);
  set(wsA3, 4, 7, "H", seccion);
  set(wsA3, 4, 8, "I", seccion);

  PLANTILLA_A3_BASE.forEach((col, i) => {
    set(wsA3, 5, i, col.campo, verde);
  });

  // Descripción de cada columna
  const descripciones = [
    "Número de asiento — entero correlativo",
    "Fecha — formato DD/MM/AAAA",
    "Código de operación — ej: 01, 034, 061",
    "Concepto del asiento",
    "Número de documento / factura",
    "Cuenta del DEBE",
    "Importe del DEBE — número sin símbolo €",
    "Importe del HABER — número sin símbolo €",
    "Cuenta del HABER",
  ];
  descripciones.forEach((d, i) => {
    set(wsA3, 6, i, d, ayudaCell);
  });

  // Ejemplo de fila real
  set(wsA3, 7, 0, "EJEMPLO DE FILA EXPORTADA:", verdeOsc);
  const ejemploFila = ["241", "15/01/2025", "034", "Fact. nº F-001 - Proveedor SA", "F-001", "629", "1000.00", "", "40000001"];
  ejemploFila.forEach((v, i) => {
    set(wsA3, 8, i, v, alterno ? planAlt : planLabel);
  });

  wsA3["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 8, c: 8 } });
  wsA3["!cols"] = [
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 32 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsA3, "PlantillaA3");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true });
  return new Blob([out], { type: "application/octet-stream" });
}

// ─── EXPORTAR asientos ────────────────────────────────────────────────────────
export function exportarAsientos(lineas: LineaAsiento[], plantillaA3: ColumnaPlantillaA3[]): Blob {
  const campos = plantillaA3.length === 9
    ? plantillaA3.map((c) => c.campo)
    : PLANTILLA_A3_BASE.map((c) => c.campo);
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

  // Cabecera verde
  camposConAviso.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[addr]) ws[addr].s = S.headerVerde;
  });

  // Filas con alerta en amarillo
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 1; r <= range.e.r; r++) {
    if (lineas[r - 1]?.alerta) {
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) ws[addr].s = S.alerta;
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
