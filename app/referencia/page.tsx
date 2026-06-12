"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BookOpen, FileCheck2, CalendarDays } from "lucide-react";

type Tab = "pgc" | "modelos" | "calendario";

const PGC_GRUPOS: { grupo: string; titulo: string; cuentas: { cuenta: string; nombre: string }[] }[] = [
  {
    grupo: "1",
    titulo: "Financiación básica",
    cuentas: [
      { cuenta: "100", nombre: "Capital social" },
      { cuenta: "112", nombre: "Reserva legal" },
      { cuenta: "113", nombre: "Reservas voluntarias" },
      { cuenta: "121", nombre: "Resultados negativos de ejercicios anteriores" },
      { cuenta: "129", nombre: "Resultado del ejercicio" },
      { cuenta: "170", nombre: "Deudas a largo plazo con entidades de crédito" },
    ],
  },
  {
    grupo: "2",
    titulo: "Inmovilizado",
    cuentas: [
      { cuenta: "210/211", nombre: "Terrenos y construcciones" },
      { cuenta: "213", nombre: "Maquinaria" },
      { cuenta: "214", nombre: "Utillaje" },
      { cuenta: "216", nombre: "Mobiliario / Elementos de transporte" },
      { cuenta: "280-281", nombre: "Amortización acumulada del inmovilizado" },
    ],
  },
  {
    grupo: "3",
    titulo: "Existencias",
    cuentas: [
      { cuenta: "300", nombre: "Mercaderías" },
      { cuenta: "390-396", nombre: "Deterioro de valor de existencias" },
    ],
  },
  {
    grupo: "4",
    titulo: "Acreedores y deudores",
    cuentas: [
      { cuenta: "400/401", nombre: "Proveedores" },
      { cuenta: "4109", nombre: "Proveedores, facturas pendientes de recibir" },
      { cuenta: "410", nombre: "Acreedores por prestación de servicios" },
      { cuenta: "430", nombre: "Clientes" },
      { cuenta: "436/490", nombre: "Clientes de dudoso cobro / deterioro" },
      { cuenta: "438", nombre: "Anticipos de clientes" },
      { cuenta: "440", nombre: "Deudores varios" },
      { cuenta: "465", nombre: "Remuneraciones pendientes de pago" },
      { cuenta: "470", nombre: "HP deudora por diversos conceptos" },
      { cuenta: "472", nombre: "IVA soportado" },
      { cuenta: "473", nombre: "HP retenciones y pagos a cuenta" },
      { cuenta: "474", nombre: "Activos por impuesto diferido" },
      { cuenta: "4700", nombre: "HP deudora por IVA" },
      { cuenta: "4750", nombre: "HP acreedora por IVA" },
      { cuenta: "4751", nombre: "HP acreedora por retenciones practicadas" },
      { cuenta: "4752", nombre: "HP acreedora por Impuesto sobre Sociedades" },
      { cuenta: "4709", nombre: "HP, pagos a cuenta del IS (fraccionados)" },
      { cuenta: "477", nombre: "IVA repercutido" },
      { cuenta: "479", nombre: "Pasivos por impuesto diferido" },
      { cuenta: "551-553", nombre: "Cuenta corriente con socios / vinculadas" },
      { cuenta: "554", nombre: "Suplidos" },
    ],
  },
  {
    grupo: "5",
    titulo: "Cuentas financieras",
    cuentas: [
      { cuenta: "520", nombre: "Deudas a corto plazo con entidades de crédito" },
      { cuenta: "570", nombre: "Caja" },
      { cuenta: "572", nombre: "Bancos" },
    ],
  },
  {
    grupo: "6",
    titulo: "Compras y gastos",
    cuentas: [
      { cuenta: "600-602", nombre: "Compras" },
      { cuenta: "621", nombre: "Arrendamientos" },
      { cuenta: "622", nombre: "Reparaciones y conservación" },
      { cuenta: "623", nombre: "Servicios de profesionales independientes" },
      { cuenta: "625", nombre: "Primas de seguros" },
      { cuenta: "626", nombre: "Servicios bancarios" },
      { cuenta: "627", nombre: "Publicidad y propaganda" },
      { cuenta: "628", nombre: "Suministros" },
      { cuenta: "629", nombre: "Otros servicios" },
      { cuenta: "630", nombre: "Impuesto sobre beneficios (IS)" },
      { cuenta: "640-649", nombre: "Gastos de personal" },
      { cuenta: "662", nombre: "Intereses de deudas" },
      { cuenta: "671/672", nombre: "Pérdidas procedentes del inmovilizado" },
      { cuenta: "678", nombre: "Gastos excepcionales" },
      { cuenta: "681", nombre: "Amortización del inmovilizado material" },
    ],
  },
  {
    grupo: "7",
    titulo: "Ventas e ingresos",
    cuentas: [
      { cuenta: "700/701", nombre: "Ventas de mercaderías / productos" },
      { cuenta: "705", nombre: "Prestaciones de servicios" },
      { cuenta: "706/708", nombre: "Descuentos y devoluciones de ventas" },
      { cuenta: "710/711", nombre: "Variación de existencias" },
      { cuenta: "76x", nombre: "Ingresos financieros" },
      { cuenta: "771/772", nombre: "Beneficios procedentes del inmovilizado" },
      { cuenta: "778", nombre: "Ingresos excepcionales" },
    ],
  },
];

const MODELOS = [
  {
    modelo: "303",
    nombre: "IVA — Autoliquidación trimestral",
    periodicidad: "Trimestral (mensual para grandes empresas)",
    plazo: "1-20 del mes siguiente al trimestre (4T: hasta 30/31 enero)",
  },
  {
    modelo: "390",
    nombre: "IVA — Resumen anual",
    periodicidad: "Anual",
    plazo: "1-30 de enero",
  },
  {
    modelo: "111",
    nombre: "Retenciones IRPF — trabajo y profesionales",
    periodicidad: "Trimestral",
    plazo: "1-20 del mes siguiente al trimestre",
  },
  {
    modelo: "115",
    nombre: "Retenciones IRPF — alquileres",
    periodicidad: "Trimestral",
    plazo: "1-20 del mes siguiente al trimestre",
  },
  {
    modelo: "190",
    nombre: "Resumen anual de retenciones (111)",
    periodicidad: "Anual",
    plazo: "1-31 de enero",
  },
  {
    modelo: "180",
    nombre: "Resumen anual de retenciones (115)",
    periodicidad: "Anual",
    plazo: "1-31 de enero",
  },
  {
    modelo: "200",
    nombre: "Impuesto sobre Sociedades",
    periodicidad: "Anual",
    plazo: "25 días tras 6 meses desde el cierre (ej. cierre 31/12 → hasta 25 julio)",
  },
  {
    modelo: "202",
    nombre: "Pagos fraccionados del IS",
    periodicidad: "Abril, octubre, diciembre",
    plazo: "1-20 de cada mes",
  },
  {
    modelo: "349",
    nombre: "Operaciones intracomunitarias",
    periodicidad: "Mensual / trimestral según volumen",
    plazo: "Según periodicidad de IVA",
  },
];

const CALENDARIO = [
  { mes: "Enero", tareas: ["Mod. 303 4T y Mod. 390 (resumen anual IVA)", "Mod. 111 y 115 4T", "Mod. 190 y 180 (resúmenes anuales de retenciones)", "Mod. 347 (operaciones con terceros >3.005,06 €)"] },
  { mes: "Abril", tareas: ["Mod. 303 1T", "Mod. 111 y 115 1T", "Mod. 202 — 1er pago fraccionado IS"] },
  { mes: "Julio", tareas: ["Mod. 303 2T", "Mod. 111 y 115 2T", "Mod. 200 — Impuesto sobre Sociedades (cierre 31/12)"] },
  { mes: "Octubre", tareas: ["Mod. 303 3T", "Mod. 111 y 115 3T", "Mod. 202 — 2º pago fraccionado IS"] },
  { mes: "Diciembre", tareas: ["Mod. 202 — 3er pago fraccionado IS", "Cierre contable: regularización de existencias, amortizaciones, periodificaciones"] },
];

export default function ReferenciaPage() {
  const [tab, setTab] = useState<Tab>("pgc");

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="06"
        title="PGC y calendario fiscal"
        description="Referencia rápida de cuentas del Plan General Contable, modelos a presentar y calendario fiscal habitual para una PYME."
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex gap-1 border-b border-[var(--color-line)]">
          <TabButton active={tab === "pgc"} onClick={() => setTab("pgc")} icon={BookOpen}>
            Plan de cuentas
          </TabButton>
          <TabButton active={tab === "modelos"} onClick={() => setTab("modelos")} icon={FileCheck2}>
            Modelos a presentar
          </TabButton>
          <TabButton active={tab === "calendario"} onClick={() => setTab("calendario")} icon={CalendarDays}>
            Calendario fiscal
          </TabButton>
        </div>

        {tab === "pgc" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {PGC_GRUPOS.map((g) => (
              <section key={g.grupo} className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                <div className="bg-[var(--color-brand)] text-white px-4 py-2 flex items-center gap-3">
                  <span className="font-mono-tab text-xs bg-white/15 px-2 py-0.5 rounded-sm">GRUPO {g.grupo}</span>
                  <span className="font-serif-display text-base">{g.titulo}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {g.cuentas.map((c, i) => (
                      <tr key={c.cuenta} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
                        <td className="px-4 py-1.5 font-mono-tab text-[var(--color-brand-dark)] font-medium w-24">{c.cuenta}</td>
                        <td className="px-4 py-1.5">{c.nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}

        {tab === "modelos" && (
          <section className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-brand)] text-white text-left">
                  <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em] w-24">Modelo</th>
                  <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em]">Nombre</th>
                  <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em] w-56">Periodicidad</th>
                  <th className="px-4 py-2 font-mono-tab text-xs tracking-[0.1em]">Plazo</th>
                </tr>
              </thead>
              <tbody>
                {MODELOS.map((m, i) => (
                  <tr key={m.modelo} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
                    <td className="px-4 py-2 font-mono-tab text-[var(--color-brand-dark)] font-medium">{m.modelo}</td>
                    <td className="px-4 py-2">{m.nombre}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{m.periodicidad}</td>
                    <td className="px-4 py-2 text-[var(--color-ink-soft)]">{m.plazo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "calendario" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CALENDARIO.map((c) => (
              <section key={c.mes} className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                <div className="bg-[var(--color-brand)] text-white px-4 py-2 font-serif-display text-base">
                  {c.mes}
                </div>
                <ul className="p-4 space-y-2 text-sm text-[var(--color-ink-soft)]">
                  {c.tareas.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-1.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="border border-dashed border-[var(--color-line)] rounded-md p-4 text-xs text-[var(--color-ink-soft)]">
          Contenido de referencia general. Para casos concretos (plazos
          ampliados, regímenes especiales, calendario del cliente activo),
          consulta el módulo 04.
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
