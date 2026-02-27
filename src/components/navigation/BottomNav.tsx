"use client";

import { usePathname, useRouter } from "next/navigation";

type TabId = "scan" | "saves" | "profile";

function tabForPath(pathname: string): TabId | null {
  if (pathname.startsWith("/scan") || pathname.startsWith("/analyzing")) return "scan";
  if (pathname.startsWith("/saves")) return "saves";
  if (pathname.startsWith("/profile") || pathname.startsWith("/faq")) return "profile";
  return null;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname ? tabForPath(pathname) : null;

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      <button
        className={`nav-item ${active === "scan" ? "active" : ""}`}
        onClick={() => router.push("/scan")}
        type="button"
      >
        <span className="nav-icon" aria-hidden>
          ⬡
        </span>
        <span className="nav-label">Scan</span>
      </button>
      <button
        className={`nav-item ${active === "saves" ? "active" : ""}`}
        onClick={() => router.push("/saves")}
        type="button"
      >
        <span className="nav-icon" aria-hidden>
          🔖
        </span>
        <span className="nav-label">Saved</span>
      </button>
      <button
        className={`nav-item ${active === "profile" ? "active" : ""}`}
        onClick={() => router.push("/profile")}
        type="button"
      >
        <span className="nav-icon" aria-hidden>
          ◉
        </span>
        <span className="nav-label">Profile</span>
      </button>
    </nav>
  );
}

