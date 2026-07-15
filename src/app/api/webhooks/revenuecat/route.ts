import { NextRequest, NextResponse } from "next/server";
import { dispatchRCEvent, type RCWebhookPayload } from "@/lib/revenuecat/webhookHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[rc webhook] REVENUECAT_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // RevenueCat sends the secret as the raw Authorization header value
  const authHeader = req.headers.get("authorization")?.trim();
  if (authHeader !== secret) {
    console.error("[rc webhook] authorization mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RCWebhookPayload;
  try {
    payload = (await req.json()) as RCWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload?.event;
  if (!event?.type || (!event?.app_user_id && event?.type !== "TRANSFER")) {
    console.error("[rc webhook] malformed payload", JSON.stringify(payload));
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  console.log(
    "[rc webhook]",
    event.type,
    event.app_user_id ?? event.transferred_to?.join(",") ?? "(no user)",
    event.product_id ?? "(no product)",
    event.environment
  );

  try {
    await dispatchRCEvent(event);
  } catch (e) {
    console.error("[rc webhook] handler error:", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
