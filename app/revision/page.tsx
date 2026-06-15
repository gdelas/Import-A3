"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerSesion } from "@/lib/sessionStore";
import { leerClienteActivo } from "@/lib/clienteStore";
import { generarYExportar } from "@/lib/generador";
import { exportarAsientos, descargarBlob } from "@/lib/excel";
import { LineaAsiento, FicheroCliente, PLANTILLA_A3_BASE } from "@/lib/types";
import {
  Download, AlertTriangle, CheckCircle2,
  Loader2, ArrowUp, ArrowDown, Pencil, X, Save,
} from "lucide-react";

export default function RevisionPage() {
  const [cliente, setCliente] = useState<FicheroCliente | null>(null);
  const [lineas, setLineas] = useState<LineaAsiento[]>([]);
  const [numInicial, setNumInicial] = useState(1);
  const [generando, setGenerando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<Partial<LineaAsiento>>({});
  const [generado, setGenerado] = useState(false);

  useEffect(() => {
    setCliente(leerClienteActivo());
  }, []);

  async function generar() {
    setGenerando(true);
    setGenerado(false);

    try {
      const sesion = leerSesion();
      let clasificaciones: Record<number, { cuenta: string; descripcion: string; confianza: string; alerta: string }> = {};

      if (sesion.movimientos.length > 0) {
        try {
          const res = await fetch("/api/clasificar-banco", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              movimientos: sesion.movimientos,
              planCuentas: cliente?.planCuentas ?? [],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.clasificaciones) {
              for (const c of data.clasificaciones) {
                clasificaciones[c.indice] = {
                  cuenta: c.cuentaContrapartida,
                  descripcion: c.descripcionContrapartida,
                  confianza: c.confianza,
                  alerta: c.alerta,
                };
              }
            }
          }
        } catch { /* continúa sin clasificación */ }
      }

      const resultado = generarYExportarSinDescargar(numInicial, clasificaciones, sesion, cliente);
      setLineas(resultado);
    } finally {
      setGenerando(false);
    }
  }

  function descargar() {
    const plantilla = cliente?.plantillaA3 ?? PLANTILLA_A3_BASE;
    const blob = exportarAsientos(lineas, plantilla);
    const nombre = `asientos_${(cliente?.cliente.nombre || "cliente").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    descargarBlob(blob, nombre);
    setGenerado(true);
  }

  function moverFila(idx: number, direccion: "arriba" | "abajo") {
    const nuevas = [...lineas];
    const objetivo = direccion === "arriba" ? idx - 1 : idx + 1;
    if (objetivo < 0 || objetivo >= nuevas.length) return;
    [nuevas[idx], nuevas[objetivo]] = [nuevas[objetivo], nuevas[idx]];
    setLineas(nuevas);
  }

  function iniciarEdicion(idx: number) {
    setEditando(idx);
    setEditBuffer({ ...lineas[idx] });
  }

  function guardarEdicion() {
    if (editando === null) return;
    const nuevas = [...lineas];
    nuevas[editando] = { ...nuevas[editando], ...editBuffer };
    // Limpiar alerta si la fila ya tiene cuenta asignada
    if (editBuffer.cuentaDebe || editBuffer.cuentaHaber) {
      nuevas[editando].alerta = undefined;
    }
    setLineas(nuevas);
    setEditando(null);
    setEditBuffer({});
  }

  function cancelarEdicion() {
    setEditando(null);
    setEditBuffer({});
  }

  function eliminarFila(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  const sesion = leerSesion();
  const tieneFacturas = sesion.facturas.length > 0;
  const tieneMovimientos = sesion.movimientos.length > 0;
  const puedeGenerar = tieneFacturas || tieneMovimientos;
  const totalAlertas = lineas.filter((l) => l.alerta).length;

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="07"
        title="Revisión y exportación"
        description="Genera los asientos, revísalos, edítalos si es necesario y descarga el XLS listo para importar en A3."
        client={cliente?.cliente.nombre || undefined}
      />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">

        {/* Panel de control */}
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-5">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 border border-[var(--color-line)] rounded-md px-4 py-2">
                <label className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink-soft)]">
                  EMPEZAR EN ASIENTO
                </label>
                <input
                  type="number"
                  min={1}
                  value={numInicial}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNumInicial(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 text-sm font-mono-tab text-[var(--color-ink)] bg-transparent outline-none border-l border-[var(--color-line)] pl-3"
                />
              </div>

              <button
                onClick={generar}
                disabled={!puedeGenerar || generando}
                className="flex items-center gap-2 bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-brand-dark)] transition-colors disabled:opacity-40"
              >
                {generando
                  ? <><Loader2 size={14} className="animate-spin" />Generando...</>
                  : <>Generar asientos</>
                }
              </button>
            </div>

            {lineas.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-[var(--color-ink-soft)]">
                  <span className="font-medium text-[var(--color-ink)]">{lineas.length}</span> filas ·{" "}
                  <span className="font-medium text-[var(--color-ink)]">
                    {new Set(lineas.map((l) => l.numAsiento)).size}
                  </span> asientos
                  {totalAlertas > 0 && (
                    <span className="text-[var(--color-amber-stamp)] ml-2">
                      · {totalAlertas} para revisar
                    </span>
                  )}
                </div>
                <button
                  onClick={descargar}
                  className="flex items-center gap-2 bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-brand-dark)] transition-colors"
                >
                  <Download size={14} />
                  Descargar XLS para A3
                </button>
              </div>
            )}
          </div>

          {!puedeGenerar && (
            <div className="mt-4 flex items-start gap-2 text-sm text-[var(--color-amber-stamp)]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Carga al menos facturas (módulo 02) o un extracto bancario (módulo 03) antes de generar.
            </div>
          )}

          {generado && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-brand)]">
              <CheckCircle2 size={15} />
              XLS descargado correctamente.
            </div>
          )}
        </div>

        {/* Tabla editable de asientos */}
        {lineas.length > 0 && (
          <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
            <div className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono-tab text-xs tracking-[0.15em] flex items-center justify-between">
              <span>ASIENTOS GENERADOS — edita, reordena o elimina filas antes de descargar</span>
              <span className="text-white/70">{lineas.length} filas</span>
            </div>

            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--color-brand-light)] border-b border-[var(--color-line)] text-left text-[var(--color-ink-soft)]">
                    <th className="px-2 py-2 font-mono-tab text-xs w-10">Nº</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-24">Fecha</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-16">Cód.</th>
                    <th className="px-2 py-2 font-mono-tab text-xs">Concepto</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-20">Doc.</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-24">Cta. debe</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-24 text-right">Imp. debe</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-24 text-right">Imp. haber</th>
                    <th className="px-2 py-2 font-mono-tab text-xs w-24">Cta. haber</th>
                    <th className="px-2 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => {
                    const esEditando = editando === i;
                    const bgClass = l.alerta
                      ? "bg-[var(--color-amber-soft)]"
                      : i % 2 === 0
                      ? "bg-white"
                      : "bg-[var(--color-brand-light)]";

                    return (
                      <tr key={i} className={`border-b border-[var(--color-line)] last:border-0 ${bgClass}`}>
                        <td className="px-2 py-1.5 font-mono-tab text-[var(--color-ink-soft)] text-xs">{l.numAsiento}</td>

                        {/* Fecha editable */}
                        <td className="px-2 py-1.5">
                          {esEditando ? (
                            <input value={editBuffer.fecha ?? l.fecha}
                              onChange={(e) => setEditBuffer({ ...editBuffer, fecha: e.target.value })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none" />
                          ) : (
                            <span className="font-mono-tab text-xs">{l.fecha}</span>
                          )}
                        </td>

                        {/* Código */}
                        <td className="px-2 py-1.5">
                          {esEditando ? (
                            <input value={editBuffer.codigoOperacion ?? l.codigoOperacion}
                              onChange={(e) => setEditBuffer({ ...editBuffer, codigoOperacion: e.target.value })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none" />
                          ) : (
                            <span className="font-mono-tab text-xs">{l.codigoOperacion}</span>
                          )}
                        </td>

                        {/* Concepto */}
                        <td className="px-2 py-1.5 max-w-[200px]">
                          {esEditando ? (
                            <input value={editBuffer.concepto ?? l.concepto}
                              onChange={(e) => setEditBuffer({ ...editBuffer, concepto: e.target.value })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs outline-none" />
                          ) : (
                            <span className="truncate block" title={l.concepto}>{l.concepto}</span>
                          )}
                        </td>

                        {/* Documento */}
                        <td className="px-2 py-1.5">
                          {esEditando ? (
                            <input value={editBuffer.documento ?? l.documento}
                              onChange={(e) => setEditBuffer({ ...editBuffer, documento: e.target.value })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none" />
                          ) : (
                            <span className="font-mono-tab text-xs">{l.documento}</span>
                          )}
                        </td>

                        {/* Cuenta debe */}
                        <td className="px-2 py-1.5">
                          {esEditando ? (
                            <input value={editBuffer.cuentaDebe ?? l.cuentaDebe}
                              onChange={(e) => setEditBuffer({ ...editBuffer, cuentaDebe: e.target.value })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none" />
                          ) : (
                            <span className={`font-mono-tab text-xs font-medium ${l.cuentaDebe ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)]"}`}>
                              {l.cuentaDebe || "—"}
                            </span>
                          )}
                        </td>

                        {/* Importe debe */}
                        <td className="px-2 py-1.5 text-right">
                          {esEditando ? (
                            <input type="number" value={editBuffer.importeDebe ?? l.importeDebe}
                              onChange={(e) => setEditBuffer({ ...editBuffer, importeDebe: Number(e.target.value) })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none text-right" />
                          ) : (
                            <span className="font-mono-tab text-xs tabular">
                              {l.importeDebe ? fmt(l.importeDebe) : ""}
                            </span>
                          )}
                        </td>

                        {/* Importe haber */}
                        <td className="px-2 py-1.5 text-right">
                          {esEditando ? (
                            <input type="number" value={editBuffer.importeHaber ?? l.importeHaber}
                              onChange={(e) => setEditBuffer({ ...editBuffer, importeHaber: Number(e.target.value) })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none text-right" />
                          ) : (
                            <span className="font-mono-tab text-xs tabular">
                              {l.importeHaber ? fmt(l.importeHaber) : ""}
                            </span>
                          )}
                        </td>

                        {/* Cuenta haber */}
                        <td className="px-2 py-1.5">
                          {esEditando ? (
                            <input value={editBuffer.cuentaHaber ?? l.cuentaHaber}
                              onChange={(e) => setEditBuffer({ ...editBuffer, cuentaHaber: e.target.value })}
                              className="w-full border border-[var(--color-brand)] rounded px-1 py-0.5 text-xs font-mono-tab outline-none" />
                          ) : (
                            <span className={`font-mono-tab text-xs font-medium ${l.cuentaHaber ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)]"}`}>
                              {l.cuentaHaber || "—"}
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {esEditando ? (
                              <>
                                <button onClick={guardarEdicion} className="text-[var(--color-brand)] hover:opacity-70 transition-opacity" title="Guardar">
                                  <Save size={13} />
                                </button>
                                <button onClick={cancelarEdicion} className="text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors" title="Cancelar">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => iniciarEdicion(i)} className="text-[var(--color-ink-soft)] hover:text-[var(--color-brand)] transition-colors" title="Editar">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => moverFila(i, "arriba")} disabled={i === 0} className="text-[var(--color-ink-soft)] hover:text-[var(--color-brand)] transition-colors disabled:opacity-20" title="Mover arriba">
                                  <ArrowUp size={12} />
                                </button>
                                <button onClick={() => moverFila(i, "abajo")} disabled={i === lineas.length - 1} className="text-[var(--color-ink-soft)] hover:text-[var(--color-brand)] transition-colors disabled:opacity-20" title="Mover abajo">
                                  <ArrowDown size={12} />
                                </button>
                                <button onClick={() => eliminarFila(i)} className="text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors" title="Eliminar fila">
                                  <X size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Alertas al pie */}
            {totalAlertas > 0 && (
              <div className="border-t border-[var(--color-line)] px-4 py-3 bg-[var(--color-amber-soft)]">
                <p className="text-xs text-[var(--color-amber-stamp)] flex items-center gap-2 mb-2 font-medium">
                  <AlertTriangle size={13} />
                  {totalAlertas} fila(s) marcadas en amarillo requieren revisión antes de importar en A3:
                </p>
                <ul className="text-xs text-[var(--color-ink-soft)] space-y-0.5 list-disc pl-5">
                  {lineas.filter((l) => l.alerta).map((l, i) => (
                    <li key={i}>{l.concepto}: {l.alerta}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Genera los asientos sin descargar — devuelve las líneas para mostrar en la tabla
function generarYExportarSinDescargar(
  numInicial: number,
  clasificacionesBanco: Record<number, { cuenta: string; descripcion: string; confianza: string; alerta: string }>,
  sesion: ReturnType<typeof leerSesion>,
  cliente: FicheroCliente | null
): LineaAsiento[] {
  const { generarAsientosFactura } = require("@/lib/asientos");
  const planCuentas = cliente?.planCuentas ?? [];
  const clienteBase = cliente?.cliente ?? {
    nombre: "", cif: "", actividad: "",
    retencion: "ninguna" as const,
    prorrata: false, porcentajeProrrata: 100,
    recargoEquivalencia: false, criterioCaja: false,
    regimenIva: "general" as const, notas: "",
  };

  // Importar funciones de ordenación
  const fechaANum = (f: string) => {
    const p = f.split("/");
    if (p.length === 3) return Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]);
    return 0;
  };

  const facturasOrdenadas = [...sesion.facturas].sort((a, b) => {
    const fd = fechaANum(a.fecha) - fechaANum(b.fecha);
    if (fd !== 0) return fd;
    const tipoOrden = (f: typeof a) => f.tipo === "compra" ? 0 : f.tipo === "venta" ? 1 : 2;
    if (tipoOrden(a) !== tipoOrden(b)) return tipoOrden(a) - tipoOrden(b);
    return Number((a.numeroFactura || "").replace(/\D/g, "") || 0) -
           Number((b.numeroFactura || "").replace(/\D/g, "") || 0);
  });

  const movsOrdenados = [...sesion.movimientos].sort((a, b) => fechaANum(a.fecha) - fechaANum(b.fecha));

  const todasFechas = new Set([
    ...facturasOrdenadas.map((f) => f.fecha || "0"),
    ...movsOrdenados.map((m) => m.fecha || "0"),
  ]);
  const fechasOrdenadas = Array.from(todasFechas).sort((a, b) => fechaANum(a) - fechaANum(b));

  const todasLineas: LineaAsiento[] = [];
  let siguiente = numInicial;

  const codigos = typeof window !== "undefined" ? (() => {
    try {
      const raw = localStorage.getItem("efa_codigos_operacion");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  })() : [];
  const codigoBanco = codigos.find((c: { tipo: string; codigo: string }) => c.tipo === "banco")?.codigo || "01";
  const cuentaBanco = planCuentas.find((p) =>
    p.concepto.toLowerCase().includes("banco principal") || p.concepto.toLowerCase().includes("banco")
  )?.cuenta || "572";

  for (const fecha of fechasOrdenadas) {
    const facturasDia = facturasOrdenadas.filter((f) => (f.fecha || "0") === fecha);
    for (const factura of facturasDia) {
      const lineas = generarAsientosFactura(factura, clienteBase, planCuentas, siguiente);
      todasLineas.push(...lineas);
      siguiente++;
    }

    const movsDia = movsOrdenados.map((m, i) => ({ m, i })).filter(({ m }) => (m.fecha || "0") === fecha);
    for (const { m, i } of movsDia) {
      const esIngreso = m.importe >= 0;
      const importe = Math.abs(Math.round((m.importe + Number.EPSILON) * 100) / 100);
      const clasif = clasificacionesBanco[i];

      const filaBanco: LineaAsiento = {
        numAsiento: siguiente, fecha: m.fecha, codigoOperacion: codigoBanco,
        concepto: m.concepto, documento: "",
        cuentaDebe: esIngreso ? cuentaBanco : "",
        importeDebe: esIngreso ? importe : 0,
        importeHaber: esIngreso ? 0 : importe,
        cuentaHaber: esIngreso ? "" : cuentaBanco,
        origen: "Extracto bancario",
      };

      let cuentaContra = "", conceptoContra = m.concepto;
      let alertaContra = "Contrapartida sin clasificar — edita la cuenta antes de importar en A3";

      if (clasif?.cuenta && clasif.confianza !== "baja") {
        cuentaContra = clasif.cuenta;
        conceptoContra = clasif.descripcion || m.concepto;
        alertaContra = clasif.confianza === "media" ? `Revisar — ${clasif.alerta || "verificar cuenta"}` : "";
      }

      const filaContra: LineaAsiento = {
        numAsiento: siguiente, fecha: m.fecha, codigoOperacion: codigoBanco,
        concepto: conceptoContra, documento: "",
        cuentaDebe: esIngreso ? "" : cuentaContra,
        importeDebe: esIngreso ? 0 : importe,
        importeHaber: esIngreso ? importe : 0,
        cuentaHaber: esIngreso ? cuentaContra : "",
        origen: "Extracto bancario",
        alerta: alertaContra || undefined,
      };

      todasLineas.push(filaBanco, filaContra);
      siguiente++;
    }
  }

  return todasLineas;
}

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
