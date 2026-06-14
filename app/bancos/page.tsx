"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerClienteActivo } from "@/lib/clienteStore";
import { guardarMovimientos, leerSesion } from "@/lib/sessionStore";
import { leerExtractoBancario } from "@/lib/banco";
import { FicheroCliente } from "@/lib/types";
import { Upload, AlertTriangle, FileSpreadsheet, UserCircle2, CheckCircle2, Trash2 } from "lucide-react";

export default function BancosPage() {
  const [cliente, setCliente] = useState<FicheroCliente | null>(null);
  const [movimientos, setMovimientos] = useState<{ fecha: string; concepto: string; importe: number }[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [archivoNombre, setArchivoNombre] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCliente(leerClienteActivo());
    const sesion = leerSesion();
    if (sesion.movimientos.length > 0) {
      setMovimientos(sesion.movimientos);
      setArchivoNombre("(sesión anterior)");
    }
  }, []);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const { movimientos: movs, avisos: av } = leerExtractoBancario(buffer);
    setMovimientos(movs);
    setAvisos(av);
    setArchivoNombre(file.name);
    guardarMovimientos(movs);
  }

  function limpiar() {
    setMovimientos([]);
    setAvisos([]);
    setArchivoNombre("");
    guardarMovimientos([]);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const totalIngresos = movimientos.filter((m) => m.importe >= 0).reduce((a, m) => a + m.importe, 0);
  const totalGastos = movimientos.filter((m) => m.importe < 0).reduce((a, m) => a + m.importe, 0);

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="03"
        title="Extracto bancario"
        description="Sube el XLS o CSV del banco. Los movimientos quedan guardados en la sesión. Los asientos se generan desde el panel principal cuando todo esté listo."
        client={cliente?.cliente.nombre || undefined}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {!cliente && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4 flex items-start gap-3">
            <UserCircle2 size={18} className="text-[var(--color-amber-stamp)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-ink-soft)]">
              <p className="font-medium text-[var(--color-ink)] mb-1">Sin cliente cargado</p>
              Sin el{" "}
              <a href="/maestro" className="text-[var(--color-brand)] underline">módulo 02</a>{" "}
              la clasificación de contrapartidas usará solo cuentas genéricas del PGC.
            </div>
          </div>
        )}

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[var(--color-line)] rounded-md p-10 text-center cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-light)] transition-colors bg-[var(--color-surface)]"
        >
          <Upload className="mx-auto mb-3 text-[var(--color-brand)]" size={28} strokeWidth={1.5} />
          <p className="font-serif-display text-lg text-[var(--color-ink)]">
            Arrastra el extracto bancario
          </p>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">XLS, XLSX o CSV</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {avisos.length > 0 && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4">
            <div className="flex items-center gap-2 mb-2 text-[var(--color-amber-stamp)] font-mono-tab text-xs tracking-[0.15em]">
              <AlertTriangle size={14} />AVISOS DE LECTURA
            </div>
            <ul className="text-sm text-[var(--color-ink-soft)] space-y-1 list-disc pl-5">
              {avisos.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {movimientos.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-mono-tab text-[var(--color-brand)]">
                <FileSpreadsheet size={15} />
                {archivoNombre}
              </div>
              <button onClick={limpiar} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors">
                <Trash2 size={13} />Quitar extracto
              </button>
            </div>

            <div className="grid grid-cols-3 gap-px bg-[var(--color-line)] border border-[var(--color-line)] rounded-md overflow-hidden">
              <Stat label="Movimientos" value={String(movimientos.length)} />
              <Stat label="Total cobros" value={fmt(totalIngresos)} positive />
              <Stat label="Total pagos" value={fmt(totalGastos)} />
            </div>

            <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
              <div className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono-tab text-xs tracking-[0.15em]">
                MOVIMIENTOS DETECTADOS
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--color-brand-light)]">
                    <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-soft)]">
                      <th className="px-4 py-2 font-mono-tab text-xs">Fecha</th>
                      <th className="px-4 py-2 font-mono-tab text-xs">Concepto</th>
                      <th className="px-4 py-2 font-mono-tab text-xs text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m, i) => (
                      <tr key={i} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
                        <td className="px-4 py-1.5 font-mono-tab text-[var(--color-ink-soft)] whitespace-nowrap">{m.fecha}</td>
                        <td className="px-4 py-1.5">{m.concepto}</td>
                        <td className={`px-4 py-1.5 text-right tabular font-medium ${m.importe >= 0 ? "text-[var(--color-brand)]" : "text-[var(--color-rubber)]"}`}>
                          {fmt(m.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-[var(--color-brand)]">
              <CheckCircle2 size={15} />
              {movimientos.length} movimientos listos. Vuelve al{" "}
              <a href="/" className="underline font-medium">panel principal</a>{" "}
              para generar los asientos.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="bg-[var(--color-surface)] p-5">
      <p className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink-soft)] mb-1">{label}</p>
      <p className={`font-serif-display text-2xl tabular ${positive ? "text-[var(--color-brand)]" : "text-[var(--color-ink)]"}`}>{value}</p>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
