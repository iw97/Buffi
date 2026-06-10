import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, parseClaudeJsonResponse } from "@/lib/anthropic";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { CLAUDE_PRIMARY_MODEL } from "@/lib/scan/models";
import { isFreeScanLimitReached } from "@/lib/scan/freeScanLimit";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

function readBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export interface ScanTagExtraction {
  fibers: { fiber: string; percentage: number }[];
  countryOfManufacture: string | null;
  styleNumber: string | null;
  confidence: "high" | "medium" | "low";
}

type ScanTagErrorBody =
  | { ok: false; confidence: "low"; message: string }
  | { ok: false; code: string; message: string }
  | { error: string };

export async function POST(req: NextRequest): Promise<NextResponse<ScanTagExtraction | ScanTagErrorBody>> {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const token = readBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = getAdminFirestore();
  if (adminDb) {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const isPro = userData?.isPro === true;
    const completedScans = typeof userData?.completedScans === "number" ? userData.completedScans : 0;
    if (isFreeScanLimitReached(completedScans, isPro)) {
      return NextResponse.json(
        { ok: false, code: "scan_limit_reached", message: "Scan limit reached. Upgrade to Buffi Pro to continue scanning." },
        { status: 403 }
      );
    }
  }

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

    const client = getAnthropicClient();
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
      model: CLAUDE_PRIMARY_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    });
    const parsed = parseClaudeJsonResponse<ScanTagExtraction>(message);
    const fibers = Array.isArray(parsed.fibers) ? parsed.fibers : [];
    const confidence = parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
    const result: ScanTagExtraction = {
      fibers,
      countryOfManufacture: typeof parsed.countryOfManufacture === "string" ? parsed.countryOfManufacture : null,
      styleNumber: typeof parsed.styleNumber === "string" ? parsed.styleNumber : null,
      confidence
    };

    // Fire-and-forget: log tag scan for manual product matching
    if (result.fibers.length > 0 || result.styleNumber) {
      const pendingDb = getAdminFirestore();
      if (pendingDb) {
        void pendingDb.collection("pendingMatches").add({
          uid,
          styleNumber: result.styleNumber ?? null,
          fibers: result.fibers,
          countryOfManufacture: result.countryOfManufacture ?? null,
          rawOcrPreview: rawText.slice(0, 300),
          confidence: result.confidence,
          status: "pending",
          createdAt: FieldValue.serverTimestamp()
        }).catch((e: Error) => console.warn("[api/scan-tag] pendingMatches write failed:", e.message));
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/scan-tag]", e);
    return NextResponse.json(
      { ok: false, confidence: "low", message: "Something went wrong" } as { ok: false; confidence: "low"; message: string },
      { status: 200 }
    );
  }
}
