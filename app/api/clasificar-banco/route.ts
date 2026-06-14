import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface MovimientoInput {
  fecha: string;
  concepto: string;
  importe: number;
}

interface CuentaPlanInput {
  concepto: string;
  cuenta: string;
}

const SYSTEM_PROMPT = `Eres un contable español experto en el Plan General Contable (PGC). 
Tu tarea es clasificar movimientos bancarios de una PYME española asignando la cuenta contable de contrapartida correcta.

Se te proporcionará:
1. Una lista de movimientos bancarios (fecha, concepto, importe)
2. El plan de cuentas del cliente con las subcuentas asignadas

Reglas:
- Importes POSITIVOS = cobros (entradas de dinero al banco) → la contrapartida suele ser un ingreso (7xx) o un cliente (430xx)
- Importes NEGATIVOS = pagos (salidas de dinero) → la contrapartida suele ser un gasto (6xx) o un proveedor (400xx)
- Usa SIEMPRE la subcuenta específica del plan de cuentas cuando el concepto permita identificar al cliente/proveedor
- Si no puedes determinar la cuenta con suficiente confianza, devuelve cuenta vacía "" y alerta explicando por qué
- Para gastos financieros (comisiones bancarias, intereses): usa 626 o 662
- Para nóminas: usa 640
- Para préstamos/cuotas: usa 520 (corto plazo) o 170 (largo plazo)
- Para impuestos/hacienda: usa la cuenta 47x correspondiente
- Para transferencias entre cuentas propias: usa 572 con aviso
- Para gastos de suministros (luz, agua, gas, teléfono): usa 628
- Para seguros: usa 625
- Para arrendamientos: usa 621

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "clasificaciones": [
    {
      "indice": 0,
      "cuentaContrapartida": "628",
      "descripcionContrapartida": "Suministros - Endesa",
      "confianza": "alta",
      "alerta": ""
    },
    {
      "indice": 1,
      "cuentaContrapartida": "",
      "descripcionContrapartida": "",
      "confianza": "baja",
      "alerta": "No se puede determinar la naturaleza del movimiento — revisar manualmente"
    }
  ]
}

Valores de confianza: "alta" (cuenta clara), "media" (probable pero revisar), "baja" (dejar en blanco para revisión manual).
Cuando confianza es "baja", cuentaContrapartida debe ser "" obligatoriamente.`;

export async function POST(req: NextRequest) {
  try {
    const { movimientos, planCuentas } = await req.json() as {
      movimientos: MovimientoInput[];
      planCuentas: CuentaPlanInput[];
    };

    if (!movimientos || movimientos.length === 0) {
      return NextResponse.json({ error: "No se han recibido movimientos." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar la variable de entorno ANTHROPIC_API_KEY en Vercel." },
        { status: 500 }
      );
    }

    const planTexto = planCuentas.length > 0
      ? planCuentas
          .filter((c) => c.cuenta)
          .map((c) => `  - ${c.concepto}: cuenta ${c.cuenta}`)
          .join("\n")
      : "  (Sin plan de cuentas específico del cliente — usar cuentas genéricas del PGC)";

    const movimientosTexto = movimientos
      .map((m, i) =>
        `  [${i}] Fecha: ${m.fecha} | Concepto: "${m.concepto}" | Importe: ${m.importe > 0 ? "+" : ""}${m.importe.toFixed(2)} €`
      )
      .join("\n");

    const userPrompt = `Plan de cuentas del cliente:
${planTexto}

Movimientos bancarios a clasificar (${movimientos.length} en total):
${movimientosTexto}

Clasifica cada movimiento asignando la cuenta de contrapartida más adecuada.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Error de la API: ${response.status} ${errText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const text: string = textBlock?.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "No se ha podido interpretar la respuesta del modelo.", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
