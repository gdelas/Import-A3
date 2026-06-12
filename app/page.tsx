import Link from "next/link";
import {
  FileText,
  Users,
  Landmark,
  MessageCircleQuestion,
  Hash,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

const modules = [
  {
    index: "01",
    href: "/facturas",
    icon: FileText,
    title: "Lector de facturas",
    description:
      "Sube facturas en PDF. Se extraen emisor, base, IVA y retención, y se generan los asientos en formato A3 según el cliente activo.",
    status: "Listo para probar",
  },
  {
    index: "02",
    href: "/maestro",
    icon: Users,
    title: "Fichero del cliente",
    description:
      "Datos fiscales, plan de cuentas con subcuentas asignadas y plantilla de importación A3 — todo en un único XLS con tres hojas.",
    status: "Listo para probar",
  },
  {
    index: "03",
    href: "/bancos",
    icon: Landmark,
    title: "Extractos bancarios",
    description:
      "Sube el XLS o CSV del banco. Cada movimiento se convierte en un asiento contra la 572, con la contrapartida marcada para clasificar.",
    status: "Pendiente de extracto de prueba",
  },
  {
    index: "04",
    href: "/consultas",
    icon: MessageCircleQuestion,
    title: "Consultas contables",
    description:
      "Dudas de PGC, IVA, retenciones o un caso concreto — en modo general o con el contexto del cliente cargado.",
    status: "Listo para probar",
  },
  {
    index: "05",
    href: "/codigos",
    icon: Hash,
    title: "Códigos de operación",
    description:
      "Tabla editable de códigos A3 por tipo de movimiento — ventas, compras con y sin IVA, banco, nóminas, impuestos.",
    status: "Listo para probar",
  },
  {
    index: "06",
    href: "/referencia",
    icon: BookOpen,
    title: "PGC y calendario fiscal",
    description:
      "Cuentas del PGC, modelos a presentar y calendario fiscal de referencia para consulta rápida durante el trabajo.",
    status: "Listo para probar",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <header className="brand-gradient text-white relative overflow-hidden">
        <div className="bg-brand-grid">
          <div className="max-w-5xl mx-auto px-6 pt-16 pb-14 relative">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-md bg-white/10 border border-white/20 flex items-center justify-center font-serif-display text-xl">
                E
              </div>
              <span className="font-mono-tab text-xs tracking-[0.3em] text-white/70 uppercase">
                External Financial Advisory
              </span>
            </div>

            <h1 className="font-serif-display text-4xl sm:text-6xl leading-[1.05] max-w-3xl">
              Del PDF al asiento,
              <br />
              <span className="text-white/60">listo para A3</span>
            </h1>

            <p className="text-white/75 mt-5 max-w-xl leading-relaxed text-base sm:text-lg">
              Seis módulos que convierten facturas, extractos bancarios y la
              ficha de cada cliente en asientos contables — con las dudas
              señaladas, no escondidas.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/maestro"
                className="inline-flex items-center gap-2 bg-white text-[var(--color-brand-dark)] px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Empezar por el cliente
                <ArrowUpRight size={15} />
              </Link>
              <Link
                href="/facturas"
                className="inline-flex items-center gap-2 border border-white/30 text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Procesar una factura
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 -mt-8 pb-20 relative">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-line)] border border-[var(--color-line)] rounded-md overflow-hidden shadow-sm">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.index}
                href={m.href}
                className="group bg-[var(--color-surface)] hover:bg-[var(--color-brand-light)] p-6 transition-colors relative flex flex-col min-h-[230px]"
              >
                <div className="flex items-start justify-between mb-5">
                  <span className="font-mono-tab text-xs tracking-[0.2em] px-2 py-1 rounded-sm bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] group-hover:bg-[var(--color-brand)] group-hover:text-white transition-colors">
                    {m.index}
                  </span>
                  <Icon
                    size={20}
                    className="text-[var(--color-brand)]"
                    strokeWidth={1.75}
                  />
                </div>

                <h2 className="font-serif-display text-xl text-[var(--color-ink)] mb-2 flex items-center gap-2">
                  {m.title}
                  <ArrowUpRight
                    size={17}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-brand)]"
                  />
                </h2>

                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed flex-1">
                  {m.description}
                </p>

                <div className="mt-5 pt-4 border-t border-[var(--color-line)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                  <span className="font-mono-tab text-xs text-[var(--color-ink-soft)] tracking-wide">
                    {m.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 border border-dashed border-[var(--color-line)] rounded-md p-6 flex flex-col sm:flex-row gap-6 sm:items-center justify-between bg-[var(--color-surface)]">
          <div>
            <p className="font-mono-tab text-xs tracking-[0.2em] text-[var(--color-rubber)] mb-1">
              PENDIENTE
            </p>
            <p className="text-sm text-[var(--color-ink-soft)] max-w-md leading-relaxed">
              Probar la extracción con una factura real y un extracto
              bancario real para ajustar la lectura a tu caso concreto.
            </p>
          </div>
          <div className="font-mono-tab text-xs text-[var(--color-ink-soft)] sm:text-right shrink-0">
            v0.3 — borrador de trabajo
          </div>
        </div>
      </main>
    </div>
  );
}
