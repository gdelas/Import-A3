"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerClienteActivo } from "@/lib/clienteStore";
import { leerExtractoBancario, generarAsientosBanco, MovimientoBancario } from "@/lib/banco";
import { exportarAsientos, descargarBlob } from "@/lib/excel";
import { FicheroCliente, LineaAsiento } from "@/lib/types";
import { Upload, Download, AlertTriangle, FileSpreadsheet, UserCircle2 } from "lucide-react";

export default function BancosPage() {
  const [cliente, setCliente] = useState<FicheroCliente | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [filas, setFilas] = useState<LineaAsiento[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [numInicial, setNumInicial] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCliente(leerClienteActivo());
  }, []);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const { movimientos: movs, avisos: av } = leerExtractoBancario(buffer);
    setMovimientos(movs);
    setAvisos(av);
    setArchivoNombre(file.name);
    setFilas(generarAsientosBanco(movs, numInicial, cliente?.planCuentas ?? []));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function exportar() {
    if (filas.length === 0) return;
    const plantilla = cliente?.plantillaA3 ?? [];
    const blob = exportarAsientos(filas, plantilla);
    descargarBlob(blob, "asientos_banco.xlsx");
  }

  const totalIngresos = movimientos.filter((m) => m.importe >= 0).reduce((a, m) => a + m.importe, 0);
  const totalGastos = movimientos.filter((m) => m.importe < 0).reduce((a, m) => a + m.importe, 0);

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="03"
        title="Extractos bancarios"
        description="Sube el XLS o CSV del banco. Se identifican fecha, concepto e importe de cada movimiento y se genera una fila de asiento contra la cuenta de banco del cliente, con la contrapartida marcada para clasificar."
        client={cliente?.cliente.nombre || undefined}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {!cliente && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4 flex items-start gap-3">
            <UserCircle2 size={18} className="text-[var(--color-amber-stamp)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-ink-soft)]">
              <p className="font-medium text-[var(--color-ink)] mb-1">Sin cliente cargado</p>
              Sin el fichero del{" "}
              <a href="/maestro" className="text-[var(--color-brand)] underline">
                módulo 02
              </a>{" "}
              se usará la cuenta 572 genérica y el formato estándar de 9 columnas.
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md px-4 py-3">
          <label className="text-sm text-[var(--color-ink-soft)] font-mono-tab text-xs tracking-[0.15em]">
            EMPEZAR NUMERACIÓN EN
          </label>
          <input
            type="number"
            min={1}
            value={numInicial}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value) || 1);
              setNumInicial(v);
              if (movimientos.length > 0) setFilas(generarAsientosBanco(movimientos, v, cliente?.planCuentas ?? []));
            }}
            className="w-24 border border-[var(--color-line)] rounded-sm px-2 py-1 text-sm font-mono-tab text-[var(--color-ink)] bg-[var(--color-paper)]"
          />
          <span className="text-xs text-[var(--color-ink-soft)]">
            Siguiente número de asiento libre en A3
          </span>
        </div>

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
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {archivoNombre && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)] font-mono-tab">
            <FileSpreadsheet size={15} className="text-[var(--color-brand)]" />
            {archivoNombre}
          </div>
        )}

        {avisos.length > 0 && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4">
            <div className="flex items-center gap-2 mb-2 text-[var(--color-amber-stamp)] font-mono-tab text-xs tracking-[0.15em]">
              <AlertTriangle size={14} />
              AVISOS DE LECTURA
            </div>
            <ul className="text-sm text-[var(--color-ink-soft)] space-y-1 list-disc pl-5">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {movimientos.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-px bg-[var(--color-line)] border border-[var(--color-line)] rounded-md overflow-hidden">
              <Stat label="Movimientos" value={String(movimientos.length)} />
              <Stat label="Total cobros" value={formatEuro(totalIngresos)} positive />
              <Stat label="Total pagos" value={formatEuro(totalGastos)} />
            </div>

            <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
              <div className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono-tab text-xs tracking-[0.15em]">
                ASIENTOS GENERADOS (formato A3)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-soft)] bg-[var(--color-brand-light)]">
                    <th className="px-4 py-2 font-mono-tab text-xs">Nº</th>
                    <th className="px-4 py-2 font-mono-tab text-xs">Fecha</th>
                    <th className="px-4 py-2 font-mono-tab text-xs">Concepto</th>
                    <th className="px-4 py-2 font-mono-tab text-xs">Cta. debe</th>
                    <th className="px-4 py-2 font-mono-tab text-xs text-right">Imp. debe</th>
                    <th className="px-4 py-2 font-mono-tab text-xs text-right">Imp. haber</th>
                    <th className="px-4 py-2 font-mono-tab text-xs">Cta. haber</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--color-line)] last:border-0 bg-[var(--color-amber-soft)]">
                      <td className="px-4 py-1.5 font-mono-tab text-[var(--color-ink-soft)]">{l.numAsiento}</td>
                      <td className="px-4 py-1.5 font-mono-tab text-[var(--color-ink-soft)]">{l.fecha}</td>
                      <td className="px-4 py-1.5">{l.concepto}</td>
                      <td className="px-4 py-1.5 font-mono-tab text-[var(--color-brand-dark)] font-medium">{l.cuentaDebe || "—"}</td>
                      <td className="px-4 py-1.5 text-right tabular">{l.importeDebe ? formatEuro(l.importeDebe) : ""}</td>
                      <td className="px-4 py-1.5 text-right tabular">{l.importeHaber ? formatEuro(l.importeHaber) : ""}</td>
                      <td className="px-4 py-1.5 font-mono-tab text-[var(--color-brand-dark)] font-medium">{l.cuentaHaber || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-[var(--color-ink-soft)]">
                <span className="font-medium text-[var(--color-ink)]">{filas.length}</span> asientos
                generados. Todas las contrapartidas quedan marcadas para
                clasificar manualmente.
              </div>
              <button
                onClick={exportar}
                className="flex items-center gap-2 bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-brand-dark)] transition-colors"
              >
                <Download size={15} />
                Exportar XLS para A3
              </button>
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
      <p
        className={`font-serif-display text-2xl tabular ${
          positive ? "text-[var(--color-brand)]" : "text-[var(--color-ink)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatEuro(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
