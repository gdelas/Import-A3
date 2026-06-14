"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText, Users, Landmark, MessageCircleQuestion,
  Hash, BookOpen, ArrowUpRight, CheckCircle2,
  AlertTriangle, Download, Loader2, RefreshCw,
} from "lucide-react";
import { leerSesion, limpiarSesion } from "@/lib/sessionStore";
import { generarYExportar } from "@/lib/generador";

interface EstadoSesion {
  tieneCliente: boolean;
  nombreCliente: string;
  numFacturas: number;
  numMovimientos: number;
}

export default function Home() {
  const [sesion, setSesion] = useState<EstadoSesion>({
    tieneCliente: false,
    nombreCliente: "",
    numFacturas: 0,
    numMovimientos: 0,
  });
  const [numInicial, setNumInicial] = useState(1);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<{ asientos: number; alertas: number } | null>(null);
  const [confirmandoLimpiar, setConfirmandoLimpiar] = useState(false);

  useEffect(() => {
    refrescarSesion();
  }, []);

  function refrescarSesion() {
    const s = leerSesion();
    setSesion({
      tieneCliente: !!s.cliente,
      nombreCliente: s.cliente?.cliente.nombre || "",
      numFacturas: s.facturas.length,
      numMovimientos: s.movimientos.length,
    });
    setResultado(null);
  }

  async function generarAsientos() {
    if (!sesion.tieneCliente && sesion.numFacturas === 0 && sesion.numMovimientos === 0) return;
    setGenerando(true);
    setResultado(null);

    try {
      // Si hay movimientos bancarios, clasificarlos primero con IA
      let clasificaciones: Record<number, { cuenta: string; descripcion: string; confianza: string; alerta: string }> = {};
      const sesionData = leerSesion();

      if (sesionData.movimientos.length > 0) {
        try {
          const res = await fetch("/api/clasificar-banco", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              movimientos: sesionData.movimientos,
              planCuentas: sesionData.cliente?.planCuentas ?? [],
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
        } catch {
          // Si falla la clasificación, continúa sin ella
        }
      }

      const resultado = generarYExportar(numInicial, clasificaciones);
      setResultado({ asientos: resultado.totalAsientos, alertas: resultado.alertas });
    } finally {
      setGenerando(false);
    }
  }

  function nuevaSesion() {
    limpiarSesion();
    setConfirmandoLimpiar(false);
    refrescarSesion();
  }

  const puedeGenerar = sesion.numFacturas > 0 || sesion.numMovimientos > 0;

  const modules = [
    { index: "01", href: "/maestro", icon: Users, title: "Fichero del cliente",
      description: "Base de todo el proceso. Datos fiscales, plan de cuentas y plantilla A3.", badge: sesion.tieneCliente ? 1 : 0 },
    { index: "02", href: "/facturas", icon: FileText, title: "Facturas PDF",
      description: "Sube las facturas del período. Se leen y quedan en sesión.", badge: sesion.numFacturas },
    { index: "03", href: "/bancos", icon: Landmark, title: "Extracto bancario",
      description: "Sube el extracto del banco. Los movimientos quedan en sesión.", badge: sesion.numMovimientos },
    { index: "04", href: "/consultas", icon: MessageCircleQuestion, title: "Consultas contables",
      description: "Dudas de PGC, IVA, IS — modo general o por cliente.", badge: 0 },
    { index: "05", href: "/codigos", icon: Hash, title: "Códigos de operación",
      description: "Tabla editable de códigos A3 por tipo de movimiento.", badge: 0 },
    { index: "06", href: "/referencia", icon: BookOpen, title: "PGC y calendario fiscal",
      description: "Cuentas del PGC, modelos y calendario de referencia.", badge: 0 },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      {/* HERO */}
      <header className="brand-gradient text-white relative overflow-hidden">
        <div className="bg-brand-grid">
          <div className="max-w-5xl mx-auto px-6 pt-14 pb-12">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-md bg-white/10 border border-white/20 flex items-center justify-center font-serif-display text-xl font-bold">
                G
              </div>
              <span className="font-mono-tab text-xs tracking-[0.3em] text-white/70 uppercase">
                gdlmp · External Financial Advisory
              </span>
            </div>
            <h1 className="font-serif-display text-4xl sm:text-5xl leading-[1.05] max-w-3xl">
              Generador de asientos
              <br />
              <span className="text-white/60">contables para A3</span>
            </h1>
            <p className="text-white/70 mt-4 max-w-lg leading-relaxed">
              Carga el cliente, sube facturas y el extracto bancario. Cuando
              todo esté listo, genera el XLS para importar en A3.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 -mt-6 pb-20 space-y-6">

        {/* PANEL DE GENERACIÓN */}
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md shadow-sm overflow-hidden">
          <div className="bg-[var(--color-brand)] text-white px-5 py-3 flex items-center justify-between">
            <span className="font-mono-tab text-xs tracking-[0.2em]">SESIÓN ACTUAL</span>
          </div>

          <div className="p-5">
            {/* Estado de la sesión */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <EstadoItem
                label="Cliente"
                valor={sesion.tieneCliente ? sesion.nombreCliente || "Cargado" : "Sin cargar"}
                ok={sesion.tieneCliente}
                href="/maestro"
              />
              <EstadoItem
                label="Facturas"
                valor={sesion.numFacturas > 0 ? `${sesion.numFacturas} leídas` : "Sin cargar"}
                ok={sesion.numFacturas > 0}
                href="/facturas"
                opcional={false}
              />
              <EstadoItem
                label="Extracto banco"
                valor={sesion.numMovimientos > 0 ? `${sesion.numMovimientos} movimientos` : "Sin cargar"}
                ok={sesion.numMovimientos > 0}
                href="/bancos"
                opcional={true}
              />
            </div>

            {/* Botón nueva sesión — siempre visible */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--color-line)]">
              <div className="text-sm text-[var(--color-ink-soft)]">
                {sesion.tieneCliente || sesion.numFacturas > 0 || sesion.numMovimientos > 0
                  ? <span>Sesión activa — <strong className="text-[var(--color-ink)]">{sesion.nombreCliente || "sin cliente"}</strong></span>
                  : <span>Sin sesión activa. Empieza cargando el cliente en el módulo 01.</span>
                }
              </div>
              {confirmandoLimpiar ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-rubber)]">¿Borrar todo y empezar con otro cliente?</span>
                  <button onClick={nuevaSesion}
                    className="bg-[var(--color-rubber)] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                    Sí, borrar todo
                  </button>
                  <button onClick={() => setConfirmandoLimpiar(false)}
                    className="border border-[var(--color-line)] px-3 py-1.5 rounded-md text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmandoLimpiar(true)}
                  className="flex items-center gap-2 border border-[var(--color-rubber)] text-[var(--color-rubber)] px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--color-rubber-soft)] transition-colors">
                  <RefreshCw size={14} />
                  Nuevo cliente
                </button>
              )}
            </div>

            {/* Warnings */}
            {!sesion.tieneCliente && (
              <div className="flex items-start gap-2 text-sm text-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] border border-[var(--color-amber-stamp)] rounded-md p-3 mb-4">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                Sin cliente cargado los asientos usarán cuentas genéricas del PGC. Carga el módulo 01 primero.
              </div>
            )}
            {!puedeGenerar && (
              <div className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)] bg-[var(--color-paper)] border border-[var(--color-line)] rounded-md p-3 mb-4">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                Carga al menos facturas (módulo 01) o un extracto bancario (módulo 03) para poder generar asientos.
              </div>
            )}

            {/* Numeración + botón generar */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 border border-[var(--color-line)] rounded-md px-4 py-2.5">
                <label className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink-soft)]">
                  EMPEZAR EN ASIENTO
                </label>
                <input
                  type="number"
                  min={1}
                  value={numInicial}
                  onChange={(e) => setNumInicial(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 text-sm font-mono-tab text-[var(--color-ink)] bg-transparent outline-none border-l border-[var(--color-line)] pl-3"
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <button
                onClick={generarAsientos}
                disabled={!puedeGenerar || generando}
                className="flex items-center gap-2 bg-[var(--color-brand)] text-white px-5 py-2.5 rounded-md font-medium text-sm hover:bg-[var(--color-brand-dark)] transition-colors disabled:opacity-40"
              >
                {generando ? <><Loader2 size={15} className="animate-spin" />Generando...</> : <><Download size={15} />Generar asientos XLS</>}
              </button>
            </div>

            {/* Resultado */}
            {resultado && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-brand)]">
                <CheckCircle2 size={15} />
                <span>
                  XLS generado — <strong>{resultado.asientos}</strong> asientos
                  {resultado.alertas > 0 && (
                    <span className="text-[var(--color-amber-stamp)] ml-2">
                      · {resultado.alertas} filas marcadas en amarillo para revisar
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* MÓDULOS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-line)] border border-[var(--color-line)] rounded-md overflow-hidden shadow-sm">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.index} href={m.href}
                className="group bg-[var(--color-surface)] hover:bg-[var(--color-brand-light)] p-6 transition-colors flex flex-col min-h-[190px]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tab text-xs tracking-[0.2em] px-2 py-1 rounded-sm bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] group-hover:bg-[var(--color-brand)] group-hover:text-white transition-colors">
                      {m.index}
                    </span>
                    {m.badge > 0 && (
                      <span className="font-mono-tab text-xs bg-[var(--color-brand)] text-white px-1.5 py-0.5 rounded-full">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <Icon size={18} className="text-[var(--color-brand)]" strokeWidth={1.75} />
                </div>
                <h2 className="font-serif-display text-lg text-[var(--color-ink)] mb-1.5 flex items-center gap-1.5">
                  {m.title}
                  <ArrowUpRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-brand)]" />
                </h2>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed flex-1">{m.description}</p>
              </Link>
            );
          })}
        </div>

        <div className="text-center font-mono-tab text-xs text-[var(--color-ink-soft)]">
          by gdlmp · v0.6
        </div>
      </main>
    </div>
  );
}

function EstadoItem({ label, valor, ok, href, opcional }: {
  label: string; valor: string; ok: boolean; href: string; opcional?: boolean;
}) {
  return (
    <Link href={href}
      className={`border rounded-md p-4 transition-colors hover:border-[var(--color-brand)] ${
        ok ? "border-[var(--color-brand)] bg-[var(--color-brand-light)]"
           : opcional ? "border-[var(--color-line)] bg-[var(--color-paper)]"
           : "border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)]"
      }`}
    >
      <p className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink-soft)] mb-1.5">{label}{opcional && " (opcional)"}</p>
      <div className="flex items-center gap-1.5">
        {ok
          ? <CheckCircle2 size={13} className="text-[var(--color-brand)] shrink-0" />
          : <AlertTriangle size={13} className={opcional ? "text-[var(--color-ink-soft)] shrink-0" : "text-[var(--color-amber-stamp)] shrink-0"} />
        }
        <span className={`text-sm font-medium truncate ${ok ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink-soft)]"}`}>
          {valor}
        </span>
      </div>
    </Link>
  );
}
