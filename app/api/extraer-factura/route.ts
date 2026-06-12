import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Eres un asistente contable que extrae datos estructurados de facturas españolas en PDF.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin backticks. El JSON debe tener exactamente estos campos:

{
  "tipo": "venta" | "compra",
  "emisor": "nombre de quien emite la factura",
  "receptor": "nombre de quien recibe la factura",
  "cif": "CIF/NIF del emisor",
  "numeroFactura": "número de factura",
  "fecha": "fecha en formato DD/MM/AAAA",
  "baseImponible": numero (suma de todas las bases, sin incluir suplidos),
  "tipoIva": numero (el tipo de IVA principal aplicado, ej 21, 10, 4, 0),
  "cuotaIva": numero (cuota total de IVA),
  "retencionPct": numero (porcentaje de retención si existe, 0 si no hay),
  "retencionImporte": numero (importe retenido, 0 si no hay),
  "total": numero (total de la factura),
  "conceptos": ["concepto 1", "concepto 2"],
  "suplidos": numero (importe de suplidos si se identifican como tales, 0 si no hay),
  "alertas": ["aviso 1", "aviso 2"]
}

Reglas:
- "tipo": determina si es "venta" (el cliente del despacho es el EMISOR) o "compra" (el cliente del despacho es el RECEPTOR). Si no puedes determinarlo con seguridad, indica "venta" y añade un aviso en "alertas" explicándolo.
- Si hay varios tipos de IVA en la misma factura, usa el tipo con mayor base imponible como "tipoIva" y suma todas las cuotas en "cuotaIva", y añade un aviso en "alertas" indicando que hay tipos de IVA mixtos y que debe revisarse.
- Si no identificas con certeza algún campo, usa 0 o cadena vacía y añade un aviso explicando qué falta.
- Las fechas deben estar en formato DD/MM/AAAA.
- Los números deben ser números JSON (sin comas, sin símbolo de moneda).
- No incluyas ningún texto antes o después del JSON.`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se ha recibido ningún archivo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

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
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Extrae los datos de esta factura siguiendo exactamente el formato JSON indicado.",
              },
            ],
          },
        ],
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

    return NextResponse.json({ archivo: file.name, ...parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
