"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CodigoOperacion, leerCodigos, guardarCodigos, restaurarCodigosBase } from "@/lib/codigos";
import { Plus, Trash2, RotateCcw, Save, CheckCircle2 } from "lucide-react";

const TIPOS: { value: CodigoOperacion["tipo"]; label: string }[] = [
  { value: "venta", label: "Venta" },
  { value: "compra", label: "Compra" },
  { value: "banco", label: "Banco" },
  { value: "nomina", label: "Nómina" },
  { value: "impuesto", label: "Impuesto" },
  { value: "otro", label: "Otro" },
];

const TIPO_COLOR: Record<CodigoOperacion["tipo"], string> = {
  venta: "var(--color-brand)",
  compra: "var(--color-amber-stamp)",
  banco: "#3B6EA8",
  nomina: "#7A5BB5",
  impuesto: "var(--color-rubber)",
  otro: "var(--color-ink-soft)",
};

export default function CodigosPage() {
  const [codigos, setCodigos] = useState<CodigoOperacion[]>([]);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    setCodigos(leerCodigos());
  }, []);

  function actualizar(i: number, campo: keyof CodigoOperacion, valor: string) {
    setCodigos((prev) => prev.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)));
    setGuardado(false);
  }

  function eliminar(i: number) {
    setCodigos((prev) => prev.filter((_, idx) => idx !== i));
    setGuardado(false);
  }

  function añadir() {
    setCodigos((prev) => [...prev, { codigo: "", descripcion: "", tipo: "otro" }]);
    setGuardado(false);
  }

  function guardar() {
    guardarCodigos(codigos);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  function restaurar() {
    restaurarCodigosBase();
    setCodigos(leerCodigos());
    setGuardado(false);
  }

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="05"
        title="Códigos de operación"
        description="Tabla de códigos A3 por tipo de movimiento. Los módulos de facturas y bancos los usan al generar asientos según si la operación es una venta, una compra con o sin IVA, etc. Añade o edita los que falten."
      />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-brand)] text-white text-left">
                <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em] w-28">Código</th>
                <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em]">Descripción</th>
                <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em] w-40">Tipo</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {codigos.map((c, i) => (
                <tr key={i} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
                  <td className="px-2 py-1.5">
                    <input
                      value={c.codigo}
                      onChange={(e) => actualizar(i, "codigo", e.target.value)}
                      placeholder="034"
                      className="w-full bg-transparent font-mono-tab text-[var(--color-brand-dark)] font-medium px-2 py-1 rounded-sm border border-transparent focus:border-[var(--color-brand)] focus:bg-white outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={c.descripcion}
                      onChange={(e) => actualizar(i, "descripcion", e.target.value)}
                      placeholder="Descripción de la operación"
                      className="w-full bg-transparent px-2 py-1 rounded-sm border border-transparent focus:border-[var(--color-brand)] focus:bg-white outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={c.tipo}
                      onChange={(e) => actualizar(i, "tipo", e.target.value)}
                      className="w-full bg-transparent px-2 py-1 rounded-sm border border-transparent focus:border-[var(--color-brand)] focus:bg-white outline-none"
                      style={{ color: TIPO_COLOR[c.tipo] }}
                    >
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => eliminar(i)}
                      className="text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {codigos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">
                    Sin códigos definidos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <button
            onClick={añadir}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-[var(--color-brand)] hover:bg-[var(--color-brand-light)] border-t border-[var(--color-line)] transition-colors"
          >
            <Plus size={15} />
            Añadir código
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={restaurar}
            className="flex items-center gap-2 border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-rubber)] hover:text-[var(--color-rubber)] transition-colors"
          >
            <RotateCcw size={15} />
            Restaurar valores iniciales
          </button>

          <button
            onClick={guardar}
            className="flex items-center gap-2 bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-brand-dark)] transition-colors"
          >
            {guardado ? <CheckCircle2 size={15} /> : <Save size={15} />}
            {guardado ? "Guardado" : "Guardar cambios"}
          </button>
        </div>

        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-5 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          <p className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink)] mb-2">
            CÓMO SE USAN
          </p>
          <p>
            El módulo 01 asigna automáticamente el código de tipo{" "}
            <span className="font-medium text-[var(--color-brand-dark)]">venta</span> a las
            facturas de venta, y el código de tipo{" "}
            <span className="font-medium text-[var(--color-amber-stamp)]">compra</span> con
            o sin IVA según la factura tenga cuota de IVA o no. Si hay varios
            códigos del mismo tipo, se usa el primero de la lista — ordénalos
            según tu preferencia.
          </p>
        </div>
      </main>
    </div>
  );
}
