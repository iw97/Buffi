"use client";

import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";

export function ProfileScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const user = auth?.user ?? null;
  const profile = auth?.profile;
  const loading = auth?.loading ?? false;
  const isConfigured = auth?.isConfigured ?? false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="auth-legal">Loading…</p>
      </div>
    );
  }

  if (!user && isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8 text-center">
        <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
          You&apos;re not signed in.
          <div style={{ marginTop: 14 }}>
            <button className="btn-primary" type="button" onClick={() => router.push("/onboarding/account")}>
              Create account / Sign in
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => router.push("/")}
            >
              Back to Splash
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8 text-center">
        <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
          You&apos;re logged out.
          <div style={{ marginTop: 14 }}>
            <button className="btn-primary" type="button" onClick={() => router.push("/")}>
              Back to Splash
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.displayName ?? profile?.displayName ?? user.email?.split("@")[0] ?? "User";
  const initial = displayName.charAt(0).toUpperCase();
  const email = user.email ?? profile?.email ?? "";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="profile-header">
        <div className="profile-header-top">
          <div className="profile-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" width={52} height={52} className="rounded-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="profile-name-block">
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">{email}</div>
          </div>
        </div>
        <div className="profile-since">
          Member since {user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
        </div>

        <div className="profile-stats-row">
          <div className="profile-stat">
            <div className="profile-stat-val">{profile?.savedCount ?? 0}</div>
            <div className="profile-stat-key">Saved</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val">{profile?.scannedCount ?? 0}</div>
            <div className="profile-stat-key">Scanned</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val">${profile?.trapsAvoidedDollars ?? 0}</div>
            <div className="profile-stat-key">Traps Avoided</div>
          </div>
        </div>
      </div>

      <div className="profile-menu">
        <div className="menu-section-label">My Account</div>

        <button className="menu-item" type="button" onClick={() => router.push("/saves")}>
          <div className="menu-item-left">
            <div className="menu-item-icon" aria-hidden>
              🔖
            </div>
            <div className="menu-item-text">
              <div className="menu-item-label">Saved Items</div>
              <div className="menu-item-sub">{(profile?.savedCount ?? 0)} items in your collection</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="menu-item-badge">{profile?.savedCount ?? 0}</span>
            <span className="menu-item-arrow" aria-hidden>
              →
            </span>
          </div>
        </button>

        <div className="menu-section-label">Preferences</div>

        <button className="menu-item" type="button" onClick={() => router.push("/onboarding/values")}>
          <div className="menu-item-left">
            <div className="menu-item-icon" aria-hidden>
              ⚙︎
            </div>
            <div className="menu-item-text">
              <div className="menu-item-label">My Values Profile</div>
              <div className="menu-item-sub">Edit your shopping values &amp; budget</div>
            </div>
          </div>
          <span className="menu-item-arrow" aria-hidden>
            →
          </span>
        </button>

        <div className="menu-section-label">Support</div>

        <button className="menu-item" type="button" onClick={() => router.push("/faq")}>
          <div className="menu-item-left">
            <div className="menu-item-icon" aria-hidden>
              ?
            </div>
            <div className="menu-item-text">
              <div className="menu-item-label">FAQ</div>
              <div className="menu-item-sub">Questions, answers &amp; contact</div>
            </div>
          </div>
          <span className="menu-item-arrow" aria-hidden>
            →
          </span>
        </button>
      </div>

      <div className="profile-logout-area">
        <button
          className="btn-logout"
          type="button"
          onClick={async () => {
            await auth?.signOut();
            router.push("/");
          }}
        >
          ← Log Out
        </button>
      </div>
    </div>
  );
}

