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

// ─── GENERAR plantilla de ejemplo rediseñada ─────────────────────────────────
export function generarPlantillaEjemplo(): Blob {
  const wb = XLSX.utils.book_new();

  // ══ HOJA 1 — CLIENTE ══
  const wsCliente = XLSX.utils.aoa_to_sheet([]);
  const addCell = (r: number, c: number, v: string | number, s?: object) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    wsCliente[addr] = cell(v, s);
  };

  // Cabecera
  addCell(0, 0, "DATOS DEL CLIENTE", S.headerVerde);
  addCell(0, 1, "VALOR", S.headerVerde);
  addCell(0, 2, "INSTRUCCIONES", S.headerVerde);
  wsCliente["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }];

  const filas: [string, string, string, boolean?][] = [
    // [campo, valorEjemplo, instrucción, esSeccion?]
    ["── IDENTIFICACIÓN ──", "", "", true],
    ["Nombre *", "Barros Mercantil 2021 S.L.", "Nombre o razón social completa"],
    ["CIF *", "B42897009", "CIF o NIF de la empresa"],
    ["Actividad", "Compraventa de inmovilizado", "Actividad económica principal"],
    ["── IVA ──", "", "", true],
    ["Régimen IVA *", "general", "Valores: general / simplificado / exento / recc"],
    ["Prorrata *", "No", "¿Aplica prorrata de IVA? Valores: Sí / No"],
    ["Porcentaje prorrata", "80", "Solo si Prorrata = Sí. Porcentaje DEDUCIBLE (ej: 80 significa que deduce el 80% del IVA soportado). Dejar vacío si Prorrata = No."],
    ["Recargo equivalencia", "No", "¿Está en recargo de equivalencia? Sí / No"],
    ["Criterio de caja", "No", "¿Aplica criterio de caja en IVA? Sí / No"],
    ["── IRPF ──", "", "", true],
    ["Retención", "15", "Tipo de retención habitual que le practican (%). Valores: ninguna / 7 / 15 / 19 / 35"],
    ["── OTROS ──", "", "", true],
    ["Notas", "", "Observaciones libres sobre el cliente"],
  ];

  filas.forEach(([campo, valor, instruccion, esSeccion], i) => {
    const r = i + 1;
    if (esSeccion) {
      addCell(r, 0, campo, S.seccion);
      addCell(r, 1, "", S.seccion);
      addCell(r, 2, "", S.seccion);
    } else {
      addCell(r, 0, campo, S.campo);
      addCell(r, 1, valor, S.valor);
      addCell(r, 2, instruccion, S.instruccion);
    }
  });

  wsCliente["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: 2 } });
  wsCliente["!cols"] = [{ wch: 24 }, { wch: 36 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsCliente, "Cliente");

  // ══ HOJA 2 — PLAN DE CUENTAS ══
  const wsPlan = XLSX.utils.aoa_to_sheet([]);
  const addPlan = (r: number, c: number, v: string, s?: object) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    wsPlan[addr] = cell(v, s);
  };

  // Cabecera
  addPlan(0, 0, "CONCEPTO", S.headerVerde);
  addPlan(0, 1, "CUENTA / SUBCUENTA", S.headerVerde);
  addPlan(0, 2, "NOTAS", S.headerVerde);

  // Instrucción general
  addPlan(1, 0, "→ Rellena la columna CUENTA con la subcuenta exacta de A3 para cada concepto.", S.alerta);
  addPlan(1, 1, "", S.alerta);
  addPlan(1, 2, "→ Puedes añadir filas para más clientes, proveedores o conceptos específicos.", S.alerta);

  // Secciones del plan
  const seccionesPlan: [string, CuentaPlan[] | string][] = [
    ["── CLIENTES Y PROVEEDORES (añade una fila por cada uno) ──", [
      { concepto: "Cliente — Barros Labradores S.L.", cuenta: "43000720", notas: "Ejemplo" },
      { concepto: "Cliente — otro cliente", cuenta: "", notas: "Añadir subcuenta" },
      { concepto: "Proveedor — Dogma Abogados", cuenta: "41000041", notas: "Ejemplo" },
      { concepto: "Proveedor — otro proveedor", cuenta: "", notas: "Añadir subcuenta" },
    ]],
    ["── CUENTAS BANCARIAS ──", PLAN_CUENTAS_BASE.filter((c) => ["Banco principal", "Caja"].includes(c.concepto))],
    ["── INGRESOS ──", PLAN_CUENTAS_BASE.filter((c) => c.concepto.startsWith("Ingreso"))],
    ["── GASTOS ──", PLAN_CUENTAS_BASE.filter((c) =>
      ["Gasto general / otros servicios", "Arrendamientos", "Suministros", "Servicios profesionales",
       "Seguros", "Servicios bancarios", "Publicidad", "Gastos de personal"].includes(c.concepto))],
    ["── CUENTAS FISCALES ──", PLAN_CUENTAS_BASE.filter((c) =>
      ["IVA soportado", "IVA repercutido", "HP retenciones soportadas", "HP retenciones practicadas", "Suplidos"].includes(c.concepto))],
  ];

  let rowPlan = 2;
  for (const [seccion, cuentas] of seccionesPlan) {
    addPlan(rowPlan, 0, seccion, S.seccion);
    addPlan(rowPlan, 1, "", S.seccion);
    addPlan(rowPlan, 2, "", S.seccion);
    rowPlan++;
    if (Array.isArray(cuentas)) {
      cuentas.forEach((c, i) => {
        const s = i % 2 === 1 ? S.altVerde : undefined;
        addPlan(rowPlan, 0, c.concepto, s);
        addPlan(rowPlan, 1, c.cuenta, s);
        addPlan(rowPlan, 2, c.notas ?? "", s ? { ...s, ...S.instruccion } : S.instruccion);
        rowPlan++;
      });
    }
  }

  wsPlan["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowPlan, c: 2 } });
  wsPlan["!cols"] = [{ wch: 42 }, { wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsPlan, "PlanCuentas");

  // ══ HOJA 3 — PLANTILLA A3 ══
  const wsPlantilla = XLSX.utils.aoa_to_sheet([]);
  const addA3 = (r: number, c: number, v: string, s?: object) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    wsPlantilla[addr] = cell(v, s);
  };

  addA3(0, 0, "INSTRUCCIONES", S.headerVerde);
  addA3(1, 0, "→ La fila 4 contiene los nombres de las 9 columnas de tu plantilla de importación en A3.", S.alerta);
  addA3(2, 0, "→ Modifica los nombres si en tu versión de A3 se llaman diferente. El orden debe ser el mismo.", S.alerta);
  addA3(3, 0, "→ No añadas ni quites columnas — siempre deben ser exactamente 9.", S.alerta);

  // Cabecera de columnas
  PLANTILLA_A3_BASE.forEach((col, i) => {
    addA3(4, i, col.campo, S.headerVerde);
  });

  // Ejemplo de fila
  const ejemploFila = ["241", "15/01/2025", "034", "Fact. nº F-001 - Proveedor SA", "F-001", "629", "1.000,00", "", "40000001"];
  ejemploFila.forEach((v, i) => {
    addA3(5, i, v, S.instruccion);
  });
  addA3(6, 0, "→ La fila anterior es un ejemplo de cómo quedaría un asiento exportado.", S.alerta);

  wsPlantilla["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 6, c: 8 } });
  wsPlantilla["!cols"] = PLANTILLA_A3_BASE.map((c) => ({
    wch: c.campo.toLowerCase().includes("concepto") ? 32 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, wsPlantilla, "PlantillaA3");

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
