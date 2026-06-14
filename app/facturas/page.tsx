"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerClienteActivo } from "@/lib/clienteStore";
import { guardarFacturas, leerSesion } from "@/lib/sessionStore";
import { FacturaExtraida, FicheroCliente } from "@/lib/types";
import {
  Upload, FileText, Loader2, AlertTriangle,
  CheckCircle2, Trash2, UserCircle2,
} from "lucide-react";

interface ProcesoFactura {
  archivo: string;
  estado: "pendiente" | "procesando" | "ok" | "error";
  factura?: FacturaExtraida;
  error?: string;
}

export default function FacturasPage() {
  const [cliente, setCliente] = useState<FicheroCliente | null>(null);
  const [items, setItems] = useState<ProcesoFactura[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCliente(leerClienteActivo());
    // Restaurar facturas ya procesadas en esta sesión
    const sesion = leerSesion();
    if (sesion.facturas.length > 0) {
      setItems(sesion.facturas.map((f) => ({
        archivo: f.archivo,
        estado: "ok" as const,
        factura: f,
      })));
    }
  }, []);

  // Cada vez que cambian los items, sincronizar con la sesión
  useEffect(() => {
    const facturas = items.filter((it) => it.estado === "ok" && it.factura).map((it) => it.factura!);
    guardarFacturas(facturas);
  }, [items]);

  async function handleFiles(files: FileList) {
    const nuevos: ProcesoFactura[] = Array.from(files).map((f) => ({
      archivo: f.name,
      estado: "pendiente",
    }));
    setItems((prev) => [...prev, ...nuevos]);

    for (const file of Array.from(files)) {
      setItems((prev) =>
        prev.map((it) => it.archivo === file.name ? { ...it, estado: "procesando" } : it)
      );

      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extraer-factura", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok || data.error) {
          setItems((prev) =>
            prev.map((it) => it.archivo === file.name
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

        setItems((prev) =>
          prev.map((it) => it.archivo === file.name
            ? { ...it, estado: "ok" as const, factura }
            : it
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it) => it.archivo === file.name
            ? { ...it, estado: "error", error: err instanceof Error ? err.message : "Error" }
            : it
          )
        );
      }
    }
  }

  function eliminar(archivo: string) {
    setItems((prev) => prev.filter((it) => it.archivo !== archivo));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  const totalOk = items.filter((it) => it.estado === "ok").length;
  const totalError = items.filter((it) => it.estado === "error").length;

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="01"
        title="Facturas PDF"
        description="Sube las facturas del período. Se leen y quedan guardadas en la sesión. Los asientos se generan desde el panel principal cuando todo esté listo."
        client={cliente?.cliente.nombre || undefined}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {!cliente && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4 flex items-start gap-3">
            <UserCircle2 size={18} className="text-[var(--color-amber-stamp)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-ink-soft)]">
              <p className="font-medium text-[var(--color-ink)] mb-1">Sin cliente cargado</p>
              Las facturas se leerán igualmente pero los asientos usarán cuentas genéricas. Carga el{" "}
              <a href="/maestro" className="text-[var(--color-brand)] underline">módulo 01</a>{" "}
              para usar las subcuentas y particularidades del cliente.
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
            Arrastra una o varias facturas en PDF
          </p>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            o haz clic para seleccionar
          </p>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-3">
            {/* Resumen */}
            <div className="flex items-center gap-4 text-sm">
              {totalOk > 0 && (
                <span className="flex items-center gap-1.5 text-[var(--color-brand)]">
                  <CheckCircle2 size={14} />
                  {totalOk} {totalOk === 1 ? "factura leída" : "facturas leídas"}
                </span>
              )}
              {totalError > 0 && (
                <span className="flex items-center gap-1.5 text-[var(--color-rubber)]">
                  <AlertTriangle size={14} />
                  {totalError} con error
                </span>
              )}
              {totalOk > 0 && (
                <span className="text-[var(--color-ink-soft)] ml-auto">
                  Vuelve al{" "}
                  <a href="/" className="text-[var(--color-brand)] underline font-medium">
                    panel principal
                  </a>{" "}
                  para generar los asientos.
                </span>
              )}
            </div>

            {items.map((it) => (
              <FacturaCard key={it.archivo} item={it} onEliminar={() => eliminar(it.archivo)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FacturaCard({ item, onEliminar }: { item: ProcesoFactura; onEliminar: () => void }) {
  return (
    <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
      <div className="bg-[var(--color-brand-light)] px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-mono-tab text-[var(--color-brand-dark)]">
          <FileText size={14} />
          {item.archivo}
        </div>
        <div className="flex items-center gap-3">
          <EstadoBadge estado={item.estado} />
          <button onClick={onEliminar} className="text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {item.estado === "error" && (
        <div className="p-4 text-sm text-[var(--color-rubber)] flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {item.error}
        </div>
      )}

      {item.estado === "ok" && item.factura && (
        <div className="p-4">
          <div className="grid sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
            <Campo label="Tipo" value={item.factura.tipo === "venta" ? "Venta" : item.factura.tipo === "compra" ? "Compra" : "Sin determinar"} />
            <Campo label="Fecha" value={item.factura.fecha || "—"} />
            <Campo label="Nº factura" value={item.factura.numeroFactura || "—"} />
            <Campo label="Emisor" value={item.factura.emisor || "—"} />
            <Campo label="Base" value={fmt(item.factura.baseImponible)} />
            <Campo label={`IVA ${item.factura.tipoIva}%`} value={fmt(item.factura.cuotaIva)} />
            {item.factura.retencionImporte > 0 && (
              <Campo label={`Retención ${item.factura.retencionPct}%`} value={fmt(item.factura.retencionImporte)} />
            )}
            <Campo label="Total" value={fmt(item.factura.total)} />
          </div>
          {item.factura.alertas.length > 0 && (
            <div className="mt-3 border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-3 text-xs text-[var(--color-amber-stamp)]">
              {item.factura.alertas.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: ProcesoFactura["estado"] }) {
  if (estado === "procesando") return (
    <span className="text-xs font-mono-tab text-[var(--color-brand)] flex items-center gap-1">
      <Loader2 size={12} className="animate-spin" />Leyendo
    </span>
  );
  if (estado === "error") return (
    <span className="text-xs font-mono-tab text-[var(--color-rubber)] flex items-center gap-1">
      <AlertTriangle size={12} />Error
    </span>
  );
  if (estado === "ok") return (
    <span className="text-xs font-mono-tab text-[var(--color-brand)] flex items-center gap-1">
      <CheckCircle2 size={12} />Leída
    </span>
  );
  return <span className="text-xs font-mono-tab text-[var(--color-ink-soft)]">En espera</span>;
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 border-b border-[var(--color-line)] sm:border-0">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      <span className="font-medium tabular">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
