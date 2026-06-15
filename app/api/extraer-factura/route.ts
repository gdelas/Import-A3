import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Eres un asistente contable experto en fiscalidad española que extrae datos estructurados de facturas en PDF.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, sin backticks:

{
  "tipo": "venta" | "compra" | "venta_intracomunitaria" | "compra_intracomunitaria" | "exportacion" | "importacion" | "desconocido",
  "esRectificativa": true | false,
  "emisor": "nombre completo de quien emite",
  "receptor": "nombre completo de quien recibe",
  "cif": "CIF/NIF del emisor",
  "cifReceptor": "CIF/NIF del receptor si aparece, cadena vacía si no",
  "numeroFactura": "número de factura completo tal como aparece",
  "fecha": "DD/MM/AAAA",
  "baseImponible": numero,
  "tipoIva": numero (tipo principal, ej: 21, 10, 4, 0),
  "cuotaIva": numero (suma de todas las cuotas de IVA),
  "tipoRecargo": numero (tipo de recargo de equivalencia si existe, ej: 5.2, 1.4, 0.5, 0 si no hay),
  "cuotaRecargo": numero (importe del recargo de equivalencia, 0 si no hay),
  "retencionPct": numero (porcentaje de retención IRPF, 0 si no hay),
  "retencionImporte": numero (importe retenido, 0 si no hay),
  "total": numero (total de la factura incluyendo todos los conceptos),
  "conceptos": ["descripción breve de cada línea"],
  "suplidos": numero (importes pagados por cuenta del cliente sin IVA, 0 si no hay),
  "alertas": ["aviso si algo es ambiguo o falta"]
}

REGLAS DE CLASIFICACIÓN DEL TIPO:

- "venta": la empresa española es el EMISOR. Factura con IVA español normal o exenta.
- "compra": la empresa española es el RECEPTOR. Factura de proveedor español con IVA.
- "venta_intracomunitaria": venta a empresa de otro país UE. Sin IVA español. El receptor tiene NIF intracomunitario (ej: FR12345678, DE123456789). Exenta art.25 LIVA.
- "compra_intracomunitaria": compra a proveedor de otro país UE. Sin IVA español en la factura. Aplica inversión del sujeto pasivo — la empresa receptora se autorepercute el IVA.
- "exportacion": venta a cliente fuera de la UE (terceros países). Sin IVA. Exenta art.21 LIVA.
- "importacion": compra a proveedor fuera de la UE. Puede venir con DUA de importación.
- "desconocido": no puedes determinar el tipo con seguridad.

RECTIFICATIVA:
- esRectificativa = true si el documento dice "factura rectificativa", "nota de abono", "nota de crédito", "abono" o similar.
- En rectificativas los importes pueden ser negativos — mantenlos negativos en el JSON.

RECARGO DE EQUIVALENCIA:
- Si la factura incluye "recargo de equivalencia" o "R.E.", extrae el tipo (tipoRecargo) y el importe (cuotaRecargo).
- Tipos habituales: 5,2% (IVA 21%), 1,4% (IVA 10%), 0,5% (IVA 4%).
- El total de la factura incluye base + IVA + recargo.

IVA MIXTO:
- Si hay varias bases con distintos tipos de IVA, usa el tipo con mayor base como "tipoIva".
- Suma todas las cuotas en "cuotaIva". Añade aviso en alertas indicando los tipos mezclados.

NÚMEROS:
- Siempre números JSON puros (sin €, sin puntos de miles, con punto decimal). Ej: 1000.50
- Si un importe es negativo (rectificativa), ponlo negativo: -1000.50

FECHAS: DD/MM/AAAA siempre.

Si algo es ambiguo o no aparece claramente en el documento, usa 0 o cadena vacía y añade un aviso en "alertas".`;

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
