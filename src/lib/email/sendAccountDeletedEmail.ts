import { Resend } from "resend";

const DEFAULT_NOTIFY_TO = "hello@buffi.app";
const FALLBACK_NOTIFY_TO = "heybuffi@gmail.com";

export type AccountDeletedEmailPayload = {
  uid: string;
  email: string;
  isPro: boolean;
  stripeCustomerId: string;
  deletedAt: string;
};

/** Notify Buffi ops that a user deleted their account. Best-effort; never throws. */
export async function sendAccountDeletedEmail(payload: AccountDeletedEmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[account-deleted-email] RESEND_API_KEY is not set; skip notification");
    return false;
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Buffi <onboarding@resend.dev>";
  const toEnv = process.env.ACCOUNT_DELETED_NOTIFY_EMAIL?.trim();
  const to = toEnv ? [toEnv] : [DEFAULT_NOTIFY_TO, FALLBACK_NOTIFY_TO];

  const text = [
    `User UID: ${payload.uid}`,
    `Email: ${payload.email}`,
    `Subscription status: ${payload.isPro}`,
    `RevenueCat customer ID: ${payload.stripeCustomerId}`,
    `Deleted at: ${payload.deletedAt}`
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: "Buffi — Account Deleted",
      text
    });
    if (error) {
      console.error("[account-deleted-email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[account-deleted-email] Resend send failed:", err);
    return false;
  }
}
