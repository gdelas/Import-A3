"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerClienteActivo } from "@/lib/clienteStore";
import { FicheroCliente } from "@/lib/types";
import { Send, Loader2, UserCircle2, Globe2, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGERENCIAS_GENERAL = [
  "¿Cómo se contabiliza la venta de un inmovilizado con plusvalía?",
  "¿Qué diferencia hay entre la 470 y la 4752?",
  "¿Cuándo se presenta el Modelo 202?",
  "¿Qué es la prorrata y cuándo se aplica?",
];

const SUGERENCIAS_CLIENTE = [
  "¿Cómo contabilizo una factura de compra con prorrata para este cliente?",
  "¿Qué modelos tiene que presentar este cliente este trimestre?",
  "Según su régimen de IVA, ¿cómo trato una factura a un cliente de Londres?",
  "Revisa si la retención configurada es la correcta para su actividad",
];

export default function ConsultasPage() {
  const [cliente, setCliente] = useState<FicheroCliente | null>(null);
  const [modo, setModo] = useState<"general" | "cliente">("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = leerClienteActivo();
    setCliente(c);
    if (c) setModo("cliente");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function enviar(texto: string) {
    if (!texto.trim() || loading) return;
    const nuevos: Message[] = [...messages, { role: "user", content: texto }];
    setMessages(nuevos);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nuevos,
          clienteContexto: modo === "cliente" && cliente ? contextoCliente(cliente) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error de conexión: ${err instanceof Error ? err.message : "desconocido"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const sugerencias = modo === "cliente" && cliente ? SUGERENCIAS_CLIENTE : SUGERENCIAS_GENERAL;

  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-col">
      <PageHeader
        index="04"
        title="Consultas contables"
        description="Preguntas sobre PGC, IVA, retenciones, modelos o el tratamiento de un caso concreto."
        client={modo === "cliente" ? cliente?.cliente.nombre || undefined : undefined}
      />

      <main className="max-w-3xl mx-auto px-6 py-8 flex-1 flex flex-col w-full">
        {/* Selector de modo */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setModo("general")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
              modo === "general"
                ? "border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)]"
            }`}
          >
            <Globe2 size={15} />
            Consulta general
          </button>
          <button
            onClick={() => setModo("cliente")}
            disabled={!cliente}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              modo === "cliente"
                ? "border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)]"
            }`}
          >
            <User size={15} />
            {cliente ? `Sobre ${cliente.cliente.nombre || "el cliente"}` : "Sin cliente cargado"}
          </button>
        </div>

        {!cliente && (
          <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4 flex items-start gap-3 mb-6">
            <UserCircle2 size={18} className="text-[var(--color-amber-stamp)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-ink-soft)]">
              Carga el{" "}
              <a href="/maestro" className="text-[var(--color-brand)] underline">
                módulo 02
              </a>{" "}
              para hacer consultas adaptadas a las particularidades de un
              cliente concreto. Mientras tanto, las respuestas serán generales.
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[300px]">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-ink-soft)] mb-3">
                {modo === "cliente" && cliente
                  ? `Preguntas con el contexto de ${cliente.cliente.nombre || "este cliente"}:`
                  : "Algunas preguntas habituales:"}
              </p>
              {sugerencias.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="block w-full text-left border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md px-4 py-3 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-md p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[var(--color-brand-light)] text-[var(--color-ink)] ml-auto max-w-[85%]"
                  : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] max-w-[90%]"
              }`}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-4 text-sm text-[var(--color-ink-soft)] flex items-center gap-2 max-w-[90%]">
              <Loader2 size={14} className="animate-spin" />
              Pensando...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(input);
          }}
          className="flex items-end gap-2 border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(input);
              }
            }}
            placeholder="Escribe tu duda contable o fiscal..."
            rows={2}
            className="flex-1 resize-none bg-transparent outline-none text-sm px-2 py-1.5 text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[var(--color-brand)] text-white p-2.5 rounded-md disabled:opacity-40 hover:bg-[var(--color-brand-dark)] transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}

function contextoCliente(c: FicheroCliente): string {
  const cl = c.cliente;
  const partes = [
    `Nombre: ${cl.nombre || "sin especificar"}`,
    `CIF: ${cl.cif || "sin especificar"}`,
    `Actividad: ${cl.actividad || "sin especificar"}`,
    `Régimen de IVA: ${cl.regimenIva}`,
    `Retención habitual: ${cl.retencion === "ninguna" ? "ninguna" : cl.retencion + "%"}`,
    `Prorrata: ${cl.prorrata ? `sí, ${cl.porcentajeProrrata}%` : "no"}`,
    `Recargo de equivalencia: ${cl.recargoEquivalencia ? "sí" : "no"}`,
    `Criterio de caja: ${cl.criterioCaja ? "sí" : "no"}`,
  ];
  if (c.planCuentas.length > 0) {
    partes.push("Plan de cuentas asignado:");
    for (const pc of c.planCuentas) {
      if (pc.cuenta) partes.push(`  - ${pc.concepto}: ${pc.cuenta}`);
    }
  }
  if (cl.notas) partes.push(`Notas: ${cl.notas}`);
  return partes.join("\n");
}
