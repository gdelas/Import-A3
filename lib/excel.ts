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

  const hojaCliente   = encontrarHoja(wb, ["cliente", "datos"]);
  const hojaPlan      = encontrarHoja(wb, ["plancuentas", "plan de cuentas", "cuentas", "plan"]);
  const hojaPlantilla = encontrarHoja(wb, ["plantillaa3", "plantilla a3", "a3", "plantilla"]);

  const cliente: ClienteMaestro = { ...PLACEHOLDER_CLIENTE };

  // ── Normalizar texto para comparar sin acentos ni signos raros ──
  const norm = (s: string) =>
    String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[*:¿?()\/\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // ── Hoja Cliente ──
  // Lee TODAS las filas como array. Para cada fila toma col A como clave y col B como valor.
  // Ignora filas donde col A no corresponde a ningún campo conocido (cabeceras, secciones, etc.)
  if (hojaCliente) {
    const sheet = wb.Sheets[hojaCliente];
    const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
      sheet, { header: 1, defval: "" }
    );

    const map: Record<string, string> = {};
    for (const row of rows) {
      const clave = norm(String(row[0] ?? ""));
      const valor = String(row[1] ?? "").trim();
      // Solo guardamos si hay valor en la columna B (ignora cabeceras y secciones vacías)
      if (clave && valor && valor !== "VALOR A RELLENAR" && valor !== "INSTRUCCIONES") {
        map[clave] = valor;
      }
    }

    // Buscar un campo probando todas sus variantes normalizadas
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = map[norm(k)];
        if (v) return v;
      }
      return "";
    };

    cliente.nombre   = get("Nombre", "Nombre / Razón social", "Nombre Razon social", "Razon social", "Cliente");
    cliente.cif      = get("CIF", "CIF / NIF", "CIF NIF", "NIF");
    cliente.actividad = get("Actividad", "Actividad económica", "Actividad economica", "Negocio");

    const regimen = get("Régimen de IVA", "Regimen de IVA", "Régimen IVA", "Regimen IVA").toLowerCase();
    if (["general", "simplificado", "exento", "recc"].includes(regimen)) {
      cliente.regimenIva = regimen as ClienteMaestro["regimenIva"];
    }

    const prorrataVal = get(
      "¿Aplica prorrata?", "Aplica prorrata", "Prorrata", "Tiene prorrata"
    ).toLowerCase();
    cliente.prorrata = ["si", "sí", "s", "true", "1", "yes"].includes(prorrataVal);

    if (cliente.prorrata) {
      const pct = get(
        "Porcentaje IVA deducible (prorrata)",
        "Porcentaje IVA deducible",
        "Porcentaje prorrata",
        "% prorrata",
        "Prorrata %",
        "Porcentaje de prorrata"
      );
      const pctNum = Number(String(pct).replace("%", "").trim());
      if (!pct || isNaN(pctNum) || pctNum <= 0 || pctNum >= 100) {
        avisos.push(
          "⚠ Prorrata marcada como Sí pero el porcentaje no está definido o no es válido. " +
          "Rellena el campo 'Porcentaje IVA deducible (prorrata)' con un número entre 1 y 99."
        );
        cliente.prorrata = false;
        cliente.porcentajeProrrata = 100;
      } else {
        cliente.porcentajeProrrata = pctNum;
      }
    }

    const recargoVal = get(
      "¿Recargo de equivalencia?", "Recargo de equivalencia", "Recargo equivalencia", "Recargo"
    ).toLowerCase();
    cliente.recargoEquivalencia = ["si", "sí", "s", "true", "1", "yes"].includes(recargoVal);

    const cajaVal = get(
      "¿Criterio de caja?", "Criterio de caja", "Criterio caja"
    ).toLowerCase();
    cliente.criterioCaja = ["si", "sí", "s", "true", "1", "yes"].includes(cajaVal);

    const ret = get(
      "Tipo de retención habitual",
      "Tipo de retencion habitual",
      "Retención",
      "Retencion",
      "Tipo retención",
      "Tipo retencion"
    ).replace("%", "").trim();
    cliente.retencion = ["7", "15", "19", "35"].includes(ret)
      ? (ret as ClienteMaestro["retencion"])
      : "ninguna";

    cliente.notas = get("Notas", "Observaciones");

    if (!cliente.nombre) {
      avisos.push(
        "No se ha encontrado el campo 'Nombre' en la hoja Cliente. " +
        "Comprueba que la columna A tiene exactamente el texto 'Nombre / Razón social' y que la columna B tiene el valor."
      );
    }
    if (!cliente.cif) {
      avisos.push("No se ha encontrado el campo 'CIF / NIF' en la hoja Cliente.");
    }
  } else {
    avisos.push("El fichero no contiene una hoja llamada 'Cliente'. Las hojas deben llamarse: Cliente, PlanCuentas y PlantillaA3.");
  }

  // ── Hoja Plan de cuentas ──
  // Lee como array con header:1 para controlar exactamente qué es cada columna.
  // La cabecera esperada es: Concepto | Subcuenta en A3 | Notas (o variantes)
  // Ignora filas de sección (col A empieza con espacio o con ──) y filas de instrucción
  let planCuentas: CuentaPlan[] = [];
  if (hojaPlan) {
    const sheet = wb.Sheets[hojaPlan];
    const allRows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
      sheet, { header: 1, defval: "" }
    );

    // Encontrar la fila de cabecera — la que tiene "concepto" en la primera columna
    let headerIdx = -1;
    let colConcepto = 0;
    let colCuenta = 1;

    for (let i = 0; i < Math.min(allRows.length, 5); i++) {
      const row = allRows[i];
      const normRow = row.map((c) => norm(String(c)));
      const idxConcepto = normRow.findIndex((c) => c === "concepto");
      if (idxConcepto >= 0) {
        headerIdx = i;
        colConcepto = idxConcepto;
        // Buscar columna de cuenta/subcuenta
        const idxCuenta = normRow.findIndex(
          (c) => c.includes("subcuenta") || c.includes("cuenta") || c === "a3"
        );
        if (idxCuenta >= 0) colCuenta = idxCuenta;
        break;
      }
    }

    const dataRows = headerIdx >= 0 ? allRows.slice(headerIdx + 1) : allRows.slice(1);

    for (const row of dataRows) {
      const concepto = String(row[colConcepto] ?? "").trim();
      const cuenta   = String(row[colCuenta] ?? "").trim();
      const notas    = String(row[2] ?? "").trim();

      // Ignorar filas vacías, filas de sección (contienen ──) y filas de instrucción
      if (!concepto) continue;
      if (concepto.includes("──") || concepto.startsWith("  ")) continue;
      if (concepto.toLowerCase().includes("rellena la columna")) continue;
      if (concepto.toLowerCase().includes("anadir") || concepto.toLowerCase().includes("añadir")) continue;
      // Ignorar filas donde el concepto es una instrucción (empieza con →)
      if (concepto.startsWith("→") || concepto.startsWith("Rellena")) continue;

      planCuentas.push({ concepto, cuenta: cuenta || "", notas: notas || undefined });
    }

    const sinCuenta = planCuentas.filter((c) => !c.cuenta).length;
    if (planCuentas.length === 0) {
      avisos.push("La hoja PlanCuentas no tiene filas válidas. Comprueba que la cabecera tiene 'Concepto' y 'Subcuenta en A3'.");
    } else if (sinCuenta > 0) {
      avisos.push(`${sinCuenta} concepto(s) sin subcuenta asignada — usarán cuentas genéricas del PGC.`);
    }
  } else {
    avisos.push("No se encontró la hoja 'PlanCuentas'. Los asientos usarán cuentas genéricas del PGC.");
  }

  // ── Hoja Plantilla A3 ──
  // Busca la fila que contiene exactamente 9 columnas con texto — esa es la cabecera
  let plantillaA3: ColumnaPlantillaA3[] = [];
  if (hojaPlantilla) {
    const sheet = wb.Sheets[hojaPlantilla];
    const allRows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(
      sheet, { header: 1, defval: "" }
    );

    // Buscar la fila con 9 celdas no vacías que NO sean letras simples (A,B,C...)
    for (const row of allRows) {
      const celdas = row.map((c) => String(c ?? "").trim()).filter((c) => c !== "");
      if (celdas.length === 9) {
        // Ignorar si todas son letras simples de columna (A, B, C...)
        const sonLetras = celdas.every((c) => /^[A-I]$/.test(c));
        if (sonLetras) continue;
        // Ignorar si son instrucciones (primera celda muy larga)
        if (celdas[0].length > 30) continue;
        plantillaA3 = celdas.map((campo, i) => ({
          letra: XLSX.utils.encode_col(i),
          campo,
        }));
        break;
      }
    }

    if (plantillaA3.length === 0) {
      avisos.push("No se encontró una fila con exactamente 9 columnas en la hoja PlantillaA3. Se usará el formato estándar.");
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
  const norm = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,;:()\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Quita prefijos habituales del plan de cuentas
  const quitarPrefijo = (s: string) =>
    norm(s)
      .replace(/^(proveedor|cliente|banco|acreedor|deudor|hacienda publica,?\s*|hp,?\s*)/i, "")
      .trim();

  // Palabras relevantes (≥4 chars)
  const palabras = (s: string) =>
    quitarPrefijo(s).split(" ").filter((w) => w.length >= 4);

  // Aliases para conceptos contables estándar — mapea términos del código
  // a cómo los puede haber escrito el usuario en su plan de cuentas
  const aliases: Record<string, string[]> = {
    "iva soportado":    ["iva soportad", "hacienda publica iva soportad", "hp iva soportad", "472"],
    "iva repercutido":  ["iva repercut", "hacienda publica iva repercut", "hp iva repercut", "477"],
    "hp retenciones soportadas": ["hp acreed reten soportad", "retenciones soportad", "473"],
    "hp retenciones practicadas": ["hp acreed reten practicad", "reten practicad", "4751", "47510"],
    "ingreso por servicios": ["prestaciones de servicios", "prestacion de servicios", "ventas servicios", "705"],
    "ingreso por ventas de mercancias": ["ventas mercancias", "ventas de mercancias", "700"],
    "compras de mercancias": ["compras mercancias", "trabajos realizados por otras", "607", "600"],
    "gasto general / otros servicios": ["otros servicios", "varios", "gastos generales", "629"],
    "arrendamientos": ["arrendamiento", "alquiler", "621"],
    "suministros": ["telefono", "luz", "agua", "suministro", "628"],
    "servicios profesionales": ["notarios", "traductores", "abogados", "asesores", "623"],
    "seguros": ["primas de seguros", "prima seguro", "625"],
    "servicios bancarios": ["comisiones banco", "comision bancaria", "626"],
    "publicidad": ["publicidad propaganda", "627"],
    "gastos de personal": ["nominas", "sueldos", "salarios", "640"],
    "suplidos": ["suplido", "554"],
    "banco principal": ["banco", "banesto", "santander", "caixabank", "bbva", "sabadell", "572"],
    "caja": ["caja", "570"],
    "cliente principal": ["cliente", "43"],
    "proveedor principal": ["proveedor", "40"],
  };

  for (const concepto of conceptos) {
    if (!concepto) continue;
    const obj = norm(concepto);
    const objSinPref = quitarPrefijo(concepto);

    // 1. Coincidencia exacta (con o sin prefijo)
    for (const c of planCuentas) {
      if (!c.cuenta) continue;
      if (norm(c.concepto) === obj || quitarPrefijo(c.concepto) === obj) return c.cuenta;
    }

    // 2. El concepto del plan está contenido en el de la factura o viceversa
    for (const c of planCuentas) {
      if (!c.cuenta) continue;
      const cNorm = quitarPrefijo(c.concepto);
      if (cNorm.length > 3 && (obj.includes(cNorm) || objSinPref.includes(cNorm))) return c.cuenta;
      if (objSinPref.length > 3 && cNorm.includes(objSinPref)) return c.cuenta;
    }

    // 3. Aliases — busca por términos alternativos del concepto buscado
    const objAlias = aliases[obj] ?? aliases[objSinPref] ?? [];
    for (const alias of objAlias) {
      for (const c of planCuentas) {
        if (!c.cuenta) continue;
        const cNorm = norm(c.concepto);
        if (cNorm.includes(alias) || alias.includes(cNorm)) return c.cuenta;
        // Si el alias es un número de cuenta (ej: "472"), busca por inicio de cuenta
        if (/^\d+$/.test(alias) && c.cuenta.startsWith(alias)) return c.cuenta;
      }
    }

    // 4. Al menos 2 palabras clave coinciden
    const palaObj = palabras(concepto);
    if (palaObj.length >= 2) {
      for (const c of planCuentas) {
        if (!c.cuenta) continue;
        const palaPlan = palabras(c.concepto);
        const coinciden = palaObj.filter((p) => palaPlan.some((pp) => pp.includes(p) || p.includes(pp)));
        if (coinciden.length >= 2) return c.cuenta;
      }
    }

    // 5. Al menos 1 palabra larga (≥6 chars) coincide
    const palaLargas = palaObj.filter((p) => p.length >= 6);
    for (const c of planCuentas) {
      if (!c.cuenta) continue;
      const palaPlan = palabras(c.concepto);
      if (palaLargas.some((p) => palaPlan.some((pp) => pp.includes(p) || p.includes(pp)))) return c.cuenta;
    }
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
  set(wsCli, r + 1, 0, "Rellena solo la columna B (valores). La columna A son los nombres de campo que la app necesita para leer el fichero — no los modifiques.", alertaCell);

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
  set(wsPlan, 1, 0, "Rellena la columna SUBCUENTA EN A3 con el código exacto de tu A3 para cada concepto. Añade todas las filas que necesites para clientes, proveedores y cuentas específicas de este cliente.", alertaCell);
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

  set(wsPlan, rp + 1, 0, "Añade todas las filas que necesites para clientes, proveedores y cuentas específicas de este cliente. Modifica libremente las subcuentas de la columna B.", alertaCell);

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
  // Usar plantilla del cliente si tiene 9 columnas, si no usar la base
  const campos = (plantillaA3?.length === 9 ? plantillaA3 : PLANTILLA_A3_BASE).map((c) => c.campo);

  // Mapeo por posición fija — las 9 columnas siempre van en este orden:
  // 0=numAsiento 1=fecha 2=codigo 3=concepto 4=documento 5=cuentaDebe 6=importeDebe 7=importeHaber 8=cuentaHaber
  const getValor = (l: LineaAsiento, pos: number): string | number => {
    switch (pos) {
      case 0: return l.numAsiento;
      case 1: return l.fecha;
      case 2: return l.codigoOperacion;
      case 3: return l.concepto;
      case 4: return l.documento;
      case 5: return l.cuentaDebe;
      case 6: return l.importeDebe || "";
      case 7: return l.importeHaber || "";
      case 8: return l.cuentaHaber;
      default: return "";
    }
  };

  const tieneAlertas = lineas.some((l) => l.alerta);
  const camposFinal = tieneAlertas ? [...campos, "Aviso"] : campos;

  const filas = lineas.map((l) => {
    const fila: Record<string, string | number> = {};
    campos.forEach((campo, pos) => {
      fila[campo] = getValor(l, pos);
    });
    if (tieneAlertas) fila["Aviso"] = l.alerta || "";
    return fila;
  });

  const ws = XLSX.utils.json_to_sheet(filas, { header: camposFinal });
  ws["!cols"] = camposFinal.map((c, i) => ({
    wch: i === 3 ? 36 : i === 8 || i === 5 ? 14 : 16
  }));

  // Cabecera verde
  camposFinal.forEach((_, i) => {
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
