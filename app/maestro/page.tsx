"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerFicheroCliente, generarPlantillaEjemplo, descargarBlob } from "@/lib/excel";
import { guardarClienteActivo } from "@/lib/clienteStore";
import { ClienteMaestro, ColumnaPlantillaA3, CuentaPlan } from "@/lib/types";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  User,
  ListTree,
  Table2,
} from "lucide-react";

type Tab = "datos" | "plan" | "plantilla";

export default function MaestroPage() {
  const [cliente, setCliente] = useState<ClienteMaestro | null>(null);
  const [planCuentas, setPlanCuentas] = useState<CuentaPlan[]>([]);
  const [plantilla, setPlantilla] = useState<ColumnaPlantillaA3[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [archivoNombre, setArchivoNombre] = useState<string>("");
  const [tab, setTab] = useState<Tab>("datos");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const { cliente: c, planCuentas: plan, plantillaA3, avisos: av } = leerFicheroCliente(buffer);
    setCliente(c);
    setPlanCuentas(plan);
    setPlantilla(plantillaA3);
    setAvisos(av);
    setArchivoNombre(file.name);
    setTab("datos");
    guardarClienteActivo({ cliente: c, planCuentas: plan, plantillaA3, archivo: file.name });
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function descargarEjemplo() {
    const blob = generarPlantillaEjemplo();
    descargarBlob(blob, "plantilla_cliente_ejemplo.xlsx");
  }

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="02"
        title="Fichero del cliente"
        description="Un único XLS con tres hojas: Cliente (datos fiscales y particularidades), PlanCuentas (subcuentas asignadas a cada concepto) y PlantillaA3 (formato de importación)."
        client={cliente?.nombre || undefined}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[320px_1fr] gap-8">
        {/* Columna izquierda: carga */}
        <div className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-[var(--color-line)] rounded-md p-8 text-center cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-light)] transition-colors bg-[var(--color-surface)]"
          >
            <Upload className="mx-auto mb-3 text-[var(--color-brand)]" size={26} strokeWidth={1.5} />
            <p className="font-serif-display text-lg text-[var(--color-ink)]">
              Arrastra el XLS del cliente
            </p>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">
              o haz clic para seleccionar
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
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

          <button
            onClick={descargarEjemplo}
            className="w-full flex items-center justify-center gap-2 border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md py-3 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
          >
            <Download size={15} />
            Descargar plantilla de ejemplo
          </button>

          <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-5 text-sm text-[var(--color-ink-soft)] leading-relaxed space-y-3">
            <p className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink)]">
              ESTRUCTURA ESPERADA
            </p>
            <div className="flex gap-2">
              <span className="font-mono-tab text-xs bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] px-1.5 py-0.5 rounded-sm shrink-0">Cliente</span>
              <span>Pares clave / valor: nombre, CIF, actividad, retención, prorrata, recargo de equivalencia, criterio de caja, régimen de IVA.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-mono-tab text-xs bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] px-1.5 py-0.5 rounded-sm shrink-0">PlanCuentas</span>
              <span>Tabla "Concepto" / "Cuenta" — cada cliente, proveedor, banco o concepto habitual con su subcuenta de A3. Ampliable libremente.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-mono-tab text-xs bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] px-1.5 py-0.5 rounded-sm shrink-0">PlantillaA3</span>
              <span>Una fila de cabecera con las 9 columnas en el orden de tu plantilla de importación.</span>
            </div>
          </div>
        </div>

        {/* Columna derecha: resultado */}
        <div>
          {!cliente && (
            <div className="h-full flex items-center justify-center border border-dashed border-[var(--color-line)] rounded-md p-10 text-center bg-[var(--color-surface)]">
              <p className="text-[var(--color-ink-soft)] text-sm max-w-xs">
                Aquí aparecerán los datos del cliente, su plan de cuentas y la
                plantilla de importación detectada.
              </p>
            </div>
          )}

          {cliente && (
            <div className="space-y-6">
              {avisos.length > 0 && (
                <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={15} className="text-[var(--color-amber-stamp)]" />
                    <span className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-amber-stamp)]">
                      AVISOS DE LECTURA
                    </span>
                  </div>
                  <ul className="text-sm text-[var(--color-ink-soft)] space-y-1 list-disc pl-5">
                    {avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {avisos.length === 0 && (
                <div className="flex items-center gap-2 text-[var(--color-brand)] text-sm">
                  <CheckCircle2 size={15} />
                  Fichero leído correctamente. Datos disponibles para los
                  demás módulos.
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 border-b border-[var(--color-line)]">
                <TabButton active={tab === "datos"} onClick={() => setTab("datos")} icon={User}>
                  Datos del cliente
                </TabButton>
                <TabButton active={tab === "plan"} onClick={() => setTab("plan")} icon={ListTree}>
                  Plan de cuentas ({planCuentas.length})
                </TabButton>
                <TabButton active={tab === "plantilla"} onClick={() => setTab("plantilla")} icon={Table2}>
                  Plantilla A3 ({plantilla.length})
                </TabButton>
              </div>

              {tab === "datos" && (
                <section className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                  <FichaDatos cliente={cliente} />
                </section>
              )}

              {tab === "plan" && (
                <section className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                  {planCuentas.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--color-ink-soft)]">
                      No se ha detectado un plan de cuentas. Usa la plantilla de ejemplo como base.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-brand)] text-white text-left">
                          <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em]">Concepto</th>
                          <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em] w-32">Cuenta</th>
                          <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em]">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planCuentas.map((c, i) => (
                          <tr
                            key={i}
                            className={`border-b border-[var(--color-line)] last:border-0 ${
                              i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""
                            } ${!c.cuenta ? "bg-[var(--color-amber-soft)]" : ""}`}
                          >
                            <td className="px-4 py-2">{c.concepto}</td>
                            <td className="px-4 py-2 font-mono-tab text-[var(--color-brand-dark)] font-medium">
                              {c.cuenta || "— sin asignar"}
                            </td>
                            <td className="px-4 py-2 text-[var(--color-ink-soft)]">{c.notas ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {tab === "plantilla" && (
                <section className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                  {plantilla.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--color-ink-soft)]">
                      No se detectaron columnas en la hoja PlantillaA3.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-brand)] text-white text-left">
                          <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em] w-16">Col.</th>
                          <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em]">Campo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plantilla.map((c, i) => (
                          <tr key={c.letra} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
                            <td className="px-4 py-2 font-mono-tab text-[var(--color-brand-dark)] font-medium">{c.letra}</td>
                            <td className="px-4 py-2">{c.campo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]"
          : "border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      }`}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function FichaDatos({ cliente }: { cliente: ClienteMaestro }) {
  const rows: [string, string][] = [
    ["Nombre", cliente.nombre || "—"],
    ["CIF", cliente.cif || "—"],
    ["Actividad", cliente.actividad || "—"],
    ["Retención", cliente.retencion === "ninguna" ? "Sin retención" : `${cliente.retencion}%`],
    ["Prorrata", cliente.prorrata ? `Sí — ${cliente.porcentajeProrrata}%` : "No"],
    ["Recargo de equivalencia", cliente.recargoEquivalencia ? "Sí" : "No"],
    ["Criterio de caja", cliente.criterioCaja ? "Sí" : "No"],
    ["Régimen de IVA", cliente.regimenIva],
  ];

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={k} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
            <td className="px-4 py-2 text-[var(--color-ink-soft)] w-1/2">{k}</td>
            <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{v}</td>
          </tr>
        ))}
        {cliente.notas && (
          <tr className="bg-[var(--color-brand-light)]">
            <td className="px-4 py-2 text-[var(--color-ink-soft)] align-top">Notas</td>
            <td className="px-4 py-2">{cliente.notas}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
