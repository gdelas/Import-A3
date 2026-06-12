import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, clienteContexto } = await req.json() as {
      messages: ChatMessage[];
      clienteContexto?: string;
    };

    const systemPrompt = `Eres un asistente contable y fiscal especializado en PYMEs españolas, PGC, IVA, IRPF e Impuesto sobre Sociedades. Respondes con precisión técnica, citando cuentas del PGC y modelos de Hacienda cuando proceda. Usas formato numérico español: punto para miles, coma para decimales (ej. 1.234,56 €).

${clienteContexto ? `Contexto del cliente actualmente cargado en la aplicación:\n${clienteContexto}\n\nUsa este contexto cuando la pregunta del usuario lo requiera, pero no lo repitas innecesariamente.` : "No hay ningún cliente cargado en este momento. Si la pregunta requiere conocer particularidades de un cliente concreto (prorrata, retenciones, subcuentas...), indícalo y responde de forma general."}`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar la variable de entorno ANTHROPIC_API_KEY en Vercel." },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Error de la API: ${response.status} ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const text: string = textBlock?.text ?? "";

    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
