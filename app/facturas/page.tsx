"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerClienteActivo } from "@/lib/clienteStore";
import { FacturaExtraida, FicheroCliente, LineaAsiento } from "@/lib/types";
import { generarAsientosFactura } from "@/lib/asientos";
import { exportarAsientos, descargarBlob } from "@/lib/excel";
import {
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Download,
  UserCircle2,
} from "lucide-react";

interface ProcesoFactura {
  archivo: string;
  estado: "pendiente" | "procesando" | "ok" | "error";
  factura?: FacturaExtraida;
  filas?: LineaAsiento[];
  error?: string;
}

export default function FacturasPage() {
  const [cliente, setCliente] = useState<FicheroCliente | null>(null);
  const [items, setItems] = useState<ProcesoFactura[]>([]);
  const [numInicial, setNumInicial] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCliente(leerClienteActivo());
  }, []);

  function recalcularNumerosCon(
    lista: ProcesoFactura[],
    inicio: number,
    cli: FicheroCliente | null
  ): ProcesoFactura[] {
    let siguiente = inicio;
    return lista.map((it) => {
      if (!it.factura || it.estado !== "ok") return it;
      const data = cli ?? leerClienteActivo();
      if (!data) return it;
      const filas = generarAsientosFactura(it.factura, data.cliente, data.planCuentas, siguiente);
      siguiente += 1;
      return { ...it, filas };
    });
  }

  async function handleFiles(files: FileList) {
    const nuevos: ProcesoFactura[] = Array.from(files).map((f) => ({
      archivo: f.name,
      estado: "pendiente",
    }));
    setItems((prev) => [...prev, ...nuevos]);

    for (const file of Array.from(files)) {
      setItems((prev) =>
        prev.map((it) => (it.archivo === file.name ? { ...it, estado: "procesando" } : it))
      );

      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extraer-factura", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok || data.error) {
          setItems((prev) =>
            prev.map((it) =>
              it.archivo === file.name
                ? { ...it, estado: "error", error: data.error || "Error al procesar" }
                : it
            )
          );
          continue;
        }

        const factura: FacturaExtraida = {
          archivo: file.name,
          tipo: data.tipo === "compra" ? "compra" : data.tipo === "venta" ? "venta" : "desconocido",
          emisor: data.emisor || "",
          receptor: data.receptor || "",
          cif: data.cif || "",
          numeroFactura: data.numeroFactura || "",
          fecha: data.fecha || "",
          baseImponible: Number(data.baseImponible) || 0,
          tipoIva: Number(data.tipoIva) || 0,
          cuotaIva: Number(data.cuotaIva) || 0,
          retencionPct: Number(data.retencionPct) || 0,
          retencionImporte: Number(data.retencionImporte) || 0,
          total: Number(data.total) || 0,
          conceptos: Array.isArray(data.conceptos) ? data.conceptos : [],
          suplidos: Number(data.suplidos) || 0,
          alertas: Array.isArray(data.alertas) ? data.alertas : [],
        };

        setItems((prev) => {
          const actualizado = prev.map((it) =>
            it.archivo === file.name ? { ...it, estado: "ok" as const, factura } : it
          );
          return recalcularNumerosCon(actualizado, numInicial, cliente);
        });
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.archivo === file.name
              ? { ...it, estado: "error", error: err instanceof Error ? err.message : "Error" }
              : it
          )
        );
      }
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function exportar() {
    const todasFilas = items.flatMap((it) => it.filas ?? []);
    if (todasFilas.length === 0) return;
    const plantilla = cliente?.plantillaA3 ?? [];
    const blob = exportarAsientos(todasFilas, plantilla);
    descargarBlob(blob, "asientos_facturas.xlsx");
  }

  const totalFilas = items.flatMap((it) => it.filas ?? []).length;
  const totalAlertas = items.flatMap((it) => it.filas ?? []).filter((l) => l.alerta).length;
  const totalAsientos = new Set(items.flatMap((it) => it.filas ?? []).map((l) => l.numAsiento)).size;

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="01"
        title="Lector de facturas"
        description="Sube una o varias facturas en PDF. Cada una se lee automáticamente y se generan los asientos según el maestro del cliente activo, en formato de 9 columnas para A3."
        client={cliente?.cliente.nombre || undefined}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {!cliente && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4 flex items-start gap-3">
            <UserCircle2 size={18} className="text-[var(--color-amber-stamp)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-ink-soft)]">
              <p className="font-medium text-[var(--color-ink)] mb-1">Sin cliente cargado</p>
              Carga primero el fichero del cliente en el{" "}
              <a href="/maestro" className="text-[var(--color-brand)] underline">
                módulo 02
              </a>{" "}
              para que los asientos usen las subcuentas, retenciones, prorrata
              y demás particularidades correctas.
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
              setItems((prev) => recalcularNumerosCon(prev, v, cliente));
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
            Arrastra una o varias facturas en PDF
          </p>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            o haz clic para seleccionar los archivos
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-4">
            {items.map((it) => (
              <FacturaCard key={it.archivo} item={it} />
            ))}

            {totalFilas > 0 && (
              <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-sm text-[var(--color-ink-soft)]">
                  <span className="font-medium text-[var(--color-ink)]">{totalAsientos}</span> asientos ·{" "}
                  <span className="font-medium text-[var(--color-ink)]">{totalFilas}</span> filas
                  {totalAlertas > 0 && (
                    <span className="text-[var(--color-amber-stamp)]">
                      {" "}
                      · {totalAlertas} con aviso para revisar
                    </span>
                  )}
                </div>
                <button
                  onClick={exportar}
                  className="flex items-center gap-2 bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-brand-dark)] transition-colors"
                >
                  <Download size={15} />
                  Exportar XLS para A3
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function FacturaCard({ item }: { item: ProcesoFactura }) {
  return (
    <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
      <div className="bg-[var(--color-brand-light)] px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-mono-tab text-[var(--color-brand-dark)]">
          <FileText size={14} />
          {item.archivo}
          {item.filas?.[0] && (
            <span className="text-[var(--color-ink-soft)]">· Asiento {item.filas[0].numAsiento}</span>
          )}
        </div>
        <Estado estado={item.estado} />
      </div>

      {item.estado === "error" && (
        <div className="p-4 text-sm text-[var(--color-rubber)] flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {item.error}
        </div>
      )}

      {item.estado === "ok" && item.factura && (
        <div className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Campo label="Tipo" value={item.factura.tipo === "venta" ? "Venta" : item.factura.tipo === "compra" ? "Compra" : "Sin determinar"} />
            <Campo label="Nº factura" value={item.factura.numeroFactura || "—"} />
            <Campo label="Fecha" value={item.factura.fecha || "—"} />
            <Campo label="Emisor" value={item.factura.emisor || "—"} />
            <Campo label="Receptor" value={item.factura.receptor || "—"} />
            <Campo label="Base imponible" value={formatEuro(item.factura.baseImponible)} />
            <Campo label={`IVA (${item.factura.tipoIva}%)`} value={formatEuro(item.factura.cuotaIva)} />
            {item.factura.retencionImporte > 0 && (
              <Campo label={`Retención (${item.factura.retencionPct}%)`} value={formatEuro(item.factura.retencionImporte)} />
            )}
            {item.factura.suplidos > 0 && (
              <Campo label="Suplidos" value={formatEuro(item.factura.suplidos)} />
            )}
            <Campo label="Total" value={formatEuro(item.factura.total)} />
          </div>

          {item.factura.alertas.length > 0 && (
            <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-3 text-sm text-[var(--color-ink-soft)]">
              <div className="flex items-center gap-2 mb-1 text-[var(--color-amber-stamp)] font-mono-tab text-xs tracking-[0.15em]">
                <AlertTriangle size={13} />
                AVISOS DE LECTURA
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {item.factura.alertas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {item.filas && item.filas.length > 0 && (
            <div>
              <p className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink-soft)] mb-2">
                ASIENTO GENERADO (formato A3)
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-brand)] text-white text-left">
                    <th className="px-2 py-1.5 font-mono-tab text-xs">Nº</th>
                    <th className="px-2 py-1.5 font-mono-tab text-xs">Cód.</th>
                    <th className="px-2 py-1.5 font-mono-tab text-xs">Concepto</th>
                    <th className="px-2 py-1.5 font-mono-tab text-xs">Cta. debe</th>
                    <th className="px-2 py-1.5 font-mono-tab text-xs text-right">Imp. debe</th>
                    <th className="px-2 py-1.5 font-mono-tab text-xs text-right">Imp. haber</th>
                    <th className="px-2 py-1.5 font-mono-tab text-xs">Cta. haber</th>
                  </tr>
                </thead>
                <tbody>
                  {item.filas.map((l, i) => (
                    <tr
                      key={i}
                      className={`border-b border-[var(--color-line)] last:border-0 ${
                        l.alerta ? "bg-[var(--color-amber-soft)]" : i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5 font-mono-tab text-[var(--color-ink-soft)]">{l.numAsiento}</td>
                      <td className="px-2 py-1.5 font-mono-tab text-[var(--color-ink-soft)]">{l.codigoOperacion}</td>
                      <td className="px-2 py-1.5">{l.concepto}</td>
                      <td className="px-2 py-1.5 font-mono-tab text-[var(--color-brand-dark)] font-medium">{l.cuentaDebe || "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular">{l.importeDebe ? formatEuro(l.importeDebe) : ""}</td>
                      <td className="px-2 py-1.5 text-right tabular">{l.importeHaber ? formatEuro(l.importeHaber) : ""}</td>
                      <td className="px-2 py-1.5 font-mono-tab text-[var(--color-brand-dark)] font-medium">{l.cuentaHaber || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {item.filas.some((l) => l.alerta) && (
                <div className="mt-2 space-y-1">
                  {item.filas.filter((l) => l.alerta).map((l, i) => (
                    <p key={i} className="text-xs text-[var(--color-amber-stamp)] flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {l.alerta}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Estado({ estado }: { estado: ProcesoFactura["estado"] }) {
  if (estado === "pendiente") {
    return <span className="text-xs font-mono-tab text-[var(--color-ink-soft)]">En espera</span>;
  }
  if (estado === "procesando") {
    return (
      <span className="text-xs font-mono-tab text-[var(--color-brand)] flex items-center gap-1.5">
        <Loader2 size={13} className="animate-spin" />
        Leyendo
      </span>
    );
  }
  if (estado === "error") {
    return (
      <span className="text-xs font-mono-tab text-[var(--color-rubber)] flex items-center gap-1.5">
        <AlertTriangle size={13} />
        Error
      </span>
    );
  }
  return (
    <span className="text-xs font-mono-tab text-[var(--color-brand)] flex items-center gap-1.5">
      <CheckCircle2 size={13} />
      Procesada
    </span>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 border-b border-[var(--color-line)] sm:border-0">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      <span className="font-medium text-[var(--color-ink)] tabular">{value}</span>
    </div>
  );
}

function formatEuro(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
