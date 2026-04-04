import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export interface ScanTagExtraction {
  fibers: { fiber: string; percentage: number }[];
  countryOfManufacture: string | null;
  styleNumber: string | null;
  confidence: "high" | "medium" | "low";
}

export async function POST(req: NextRequest): Promise<NextResponse<ScanTagExtraction | { ok: false; confidence: "low"; message: string }>> {
  try {
    const body = await req.json();
    let base64 = typeof body?.image === "string" ? body.image.trim() : "";
    if (!base64) {
      return NextResponse.json(
        { ok: false, confidence: "low", message: "Missing image data" },
        { status: 400 }
      );
    }
    if (base64.includes("base64,")) base64 = base64.split("base64,")[1]?.trim() ?? base64;

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey?.trim()) {
      console.error("[api/scan-tag] GOOGLE_CLOUD_VISION_API_KEY not set");
      return NextResponse.json(
        { ok: false, confidence: "low", message: "Server configuration error" },
        { status: 500 }
      );
    }

    const visionRes = await fetch(`${VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "TEXT_DETECTION" }]
          }
        ]
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.warn("[api/scan-tag] Vision API error", visionRes.status, errText);
      return NextResponse.json(
        { ok: false, confidence: "low", message: "Could not read label image" },
        { status: 200 }
      );
    }

    const visionData = (await visionRes.json()) as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        error?: { message?: string };
      }>;
    };
    const first = visionData.responses?.[0];
    if (first?.error) {
      console.warn("[api/scan-tag] Vision response error", first.error);
      return NextResponse.json(
        { ok: false, confidence: "low", message: "Could not read label image" },
        { status: 200 }
      );
    }
    const rawText = first?.fullTextAnnotation?.text?.trim() ?? "";
    if (!rawText) {
      return NextResponse.json(
        { ok: false, confidence: "low", message: "No text detected on image" },
        { status: 200 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `Extract fiber composition from this clothing label text. Return JSON only with this shape:
{
  "fibers": [{ "fiber": string, "percentage": number }],
  "countryOfManufacture": string or null,
  "styleNumber": string or null,
  "confidence": "high" | "medium" | "low"
}
Preserve branded fiber names exactly when printed on the label (e.g. "Naia Renew", "Naia") — do not rename them to generic "acetate" if the label specifies the brand. Cellulose acetate / acetate / triacetate are cellulosic (wood pulp); they are not the same as polyester.
If no composition data is found return confidence: "low" and empty fibers array.
Raw label text:
${rawText.slice(0, 8000)}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    const text =
      (message.content as Array<{ type?: string; text?: string }>)
        ?.filter((c) => c.type === "text" && c.text)
        ?.map((c) => c.text!)
        ?.join("") ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, confidence: "low", message: "Could not parse label" },
        { status: 200 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as ScanTagExtraction;
    const fibers = Array.isArray(parsed.fibers) ? parsed.fibers : [];
    const confidence = parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
    const result: ScanTagExtraction = {
      fibers,
      countryOfManufacture: typeof parsed.countryOfManufacture === "string" ? parsed.countryOfManufacture : null,
      styleNumber: typeof parsed.styleNumber === "string" ? parsed.styleNumber : null,
      confidence
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/scan-tag]", e);
    return NextResponse.json(
      { ok: false, confidence: "low", message: "Something went wrong" } as { ok: false; confidence: "low"; message: string },
      { status: 200 }
    );
  }
}
