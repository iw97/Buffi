import { redirect } from "next/navigation";

/** Canonical full paywall lives at /upgrade — keep /paywall as an alias. */
export default function Page() {
  redirect("/upgrade");
}
