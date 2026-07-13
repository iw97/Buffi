"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { onboardingIntroPath } from "@/lib/auth/onboardingStatus";
import { userHasEmailPasswordProvider } from "@/lib/auth/authProviders";
import { ChangePasswordModal } from "@/components/profile/ChangePasswordModal";

/** Set to true to always show the logged-in profile UI (for testing). */
const TESTING_ALWAYS_SHOW_LOGGED_IN = false;

const MOCK_DISPLAY = {
  displayName: "Test User",
  email: "test@buffi.app",
  initial: "T",
  memberSince: "January 2025",
  savedCount: 2,
  scannedCount: 5,
  trapsAvoided: 4,
  estimatedMoneySaved: 312,
  completedScans: 12
};

function formatImpactMoney(amount: number): string {
  const rounded = Math.round(amount);
  return `$${rounded.toLocaleString("en-US")}`;
}

export function ProfileScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const user = TESTING_ALWAYS_SHOW_LOGGED_IN ? null : (auth?.user ?? null);
  const profile = auth?.profile;
  const loading = auth?.loading ?? true;

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const closeDeleteConfirm = () => {
    if (deleteBusy) return;
    setDeleteConfirmOpen(false);
    setDeleteError(null);
  };

  const openManageSubscription = async () => {
    if (!user || portalBusy) return;
    setPortalBusy(true);
    setPortalError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not open billing portal");
      }
      window.location.href = data.url;
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : "Could not open billing portal");
      setPortalBusy(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not delete account");
      }
      closeDeleteConfirm();
      try {
        await auth?.signOut();
      } catch {
        router.replace("/signin");
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="auth-legal">Loading…</p>
      </div>
    );
  }

  if (!user && !TESTING_ALWAYS_SHOW_LOGGED_IN) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8 text-center">
        <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
          You&apos;re not signed in.
          <div style={{ marginTop: 14 }}>
            <button className="btn-primary" type="button" onClick={() => router.push(onboardingIntroPath("/profile"))}>
              Create account / Sign in
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => router.push("/")}
            >
              HOME
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = TESTING_ALWAYS_SHOW_LOGGED_IN
    ? MOCK_DISPLAY.displayName
    : (user!.displayName ?? profile?.displayName ?? user!.email?.split("@")[0] ?? "User");
  const initial = TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.initial : displayName.charAt(0).toUpperCase();
  const email = TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.email : (user!.email ?? profile?.email ?? "");
  const isPro = TESTING_ALWAYS_SHOW_LOGGED_IN ? true : (profile?.isPro ?? false);
  const trapsAvoided = TESTING_ALWAYS_SHOW_LOGGED_IN
    ? MOCK_DISPLAY.trapsAvoided
    : (profile?.trapsAvoided ?? 0);
  const estimatedMoneySaved = TESTING_ALWAYS_SHOW_LOGGED_IN
    ? MOCK_DISPLAY.estimatedMoneySaved
    : (profile?.estimatedMoneySaved ?? 0);
  const completedScans = TESTING_ALWAYS_SHOW_LOGGED_IN
    ? MOCK_DISPLAY.completedScans
    : (profile?.completedScans ?? 0);
  const canChangePassword = !TESTING_ALWAYS_SHOW_LOGGED_IN && user && userHasEmailPasswordProvider(user);
  const stripeCustomerId =
    !TESTING_ALWAYS_SHOW_LOGGED_IN && typeof profile?.stripeCustomerId === "string"
      ? profile.stripeCustomerId.trim()
      : "";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="profile-header">
        <div className="profile-header-top">
          <div className="profile-avatar">
            {user?.photoURL ? (
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
          Member since {TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.memberSince : (user!.metadata?.creationTime ? new Date(user!.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—")}
        </div>

        <div className="profile-stats-row profile-stats-row--two">
          <div className="profile-stat">
            <div className="profile-stat-val">{TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.savedCount : (profile?.savedCount ?? 0)}</div>
            <div className="profile-stat-key">Saved</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-val">{TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.scannedCount : (profile?.scannedCount ?? 0)}</div>
            <div className="profile-stat-key">Scanned</div>
          </div>
        </div>

        {!isPro && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => router.push("/upgrade")}
          >
            Unlock Full Access
          </button>
        )}
      </div>

      <section className="profile-impact" aria-labelledby="profile-impact-heading">
        <h2 id="profile-impact-heading" className="profile-impact-heading">
          YOUR IMPACT
        </h2>

        {isPro ? (
          <>
            <div className="profile-impact-stats">
              <div className="profile-impact-stat">
                <div className="profile-impact-stat-val">{trapsAvoided}</div>
                <div className="profile-impact-stat-key">RETAIL TRAPS AVOIDED</div>
              </div>
              <div className="profile-impact-stat">
                <div className="profile-impact-stat-val">{formatImpactMoney(estimatedMoneySaved)}</div>
                <div className="profile-impact-stat-key">ESTIMATED SAVINGS</div>
              </div>
              <div className="profile-impact-stat">
                <div className="profile-impact-stat-val">{completedScans}</div>
                <div className="profile-impact-stat-key">TOTAL SCANS</div>
              </div>
            </div>
            <p className="profile-impact-disclaimer">
              Savings estimated from scans you chose not to save after a Not Worth It verdict.
            </p>
          </>
        ) : (
          <button
            type="button"
            className="profile-impact-locked-btn"
            onClick={() => router.push("/upgrade")}
          >
            <div className="profile-impact-stats profile-impact-stats--locked">
              <div className="profile-impact-stat">
                <div className="profile-impact-stat-val profile-impact-stat-val--placeholder">12</div>
                <div className="profile-impact-stat-key">RETAIL TRAPS AVOIDED</div>
              </div>
              <div className="profile-impact-stat">
                <div className="profile-impact-stat-val profile-impact-stat-val--placeholder">$340</div>
                <div className="profile-impact-stat-key">ESTIMATED SAVINGS</div>
              </div>
              <div className="profile-impact-stat">
                <div className="profile-impact-stat-val profile-impact-stat-val--placeholder">8</div>
                <div className="profile-impact-stat-key">TOTAL SCANS</div>
              </div>
            </div>
            <div className="profile-impact-overlay">
              <span className="profile-impact-lock" aria-hidden>
                ◆
              </span>
              Unlock with Buffi Pro
            </div>
          </button>
        )}
      </section>

      <div className="profile-menu">
        <div className="menu-section-label">My Account</div>

        <button className="menu-item" type="button" onClick={() => router.push("/saves")}>
          <div className="menu-item-left">
            <div className="menu-item-icon" aria-hidden>
              🔖
            </div>
            <div className="menu-item-text">
              <div className="menu-item-label">Saved Items</div>
              <div className="menu-item-sub">{(TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.savedCount : (profile?.savedCount ?? 0))} items in your collection</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="menu-item-badge">{TESTING_ALWAYS_SHOW_LOGGED_IN ? MOCK_DISPLAY.savedCount : (profile?.savedCount ?? 0)}</span>
            <span className="menu-item-arrow" aria-hidden>
              →
            </span>
          </div>
        </button>

        {canChangePassword && (
          <button
            className="menu-item"
            type="button"
            onClick={() => setChangePasswordOpen(true)}
          >
            <div className="menu-item-left">
              <div className="menu-item-icon" aria-hidden>
                🔒
              </div>
              <div className="menu-item-text">
                <div className="menu-item-label">Change password</div>
                <div className="menu-item-sub">Update your sign-in password</div>
              </div>
            </div>
            <span className="menu-item-arrow" aria-hidden>
              →
            </span>
          </button>
        )}

        <div className="menu-section-label">Preferences</div>

        <button
          className="menu-item"
          type="button"
          onClick={() =>
            router.push(`/onboarding/values?${new URLSearchParams({ returnTo: "/profile" }).toString()}`)
          }
        >
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

        {!TESTING_ALWAYS_SHOW_LOGGED_IN && (
          <>
            <div className="menu-section-label">Manage account</div>
            <div className="manage-account-block">
              {stripeCustomerId ? (
                <button
                  className="btn-manage-subscription"
                  type="button"
                  disabled={portalBusy || deleteBusy}
                  onClick={() => void openManageSubscription()}
                >
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </button>
              ) : (
                <p className="manage-account-no-sub">No active subscription</p>
              )}
              {portalError && (
                <p className="delete-account-error" role="alert">
                  {portalError}
                </p>
              )}
              <div className="danger-zone">
                <div className="danger-zone-divider" aria-hidden />
                <div className="danger-zone-label">Danger zone</div>
                <button
                  className="btn-delete-account-muted"
                  type="button"
                  disabled={deleteBusy || portalBusy}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  Delete account
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="profile-logout-area">
        <button
          className="btn-logout"
          type="button"
          disabled={deleteBusy || portalBusy}
          onClick={async () => {
            await auth?.signOut();
          }}
        >
          ← Log Out
        </button>
      </div>

      <div
        className={`share-modal ${deleteConfirmOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={closeDeleteConfirm}
      >
        <div className="share-modal-inner" onClick={(e) => e.stopPropagation()}>
          <h2 id="delete-account-title" className="pw-modal-title" style={{ marginTop: 0 }}>
            Delete your account?
          </h2>
          <p className="pw-modal-sub" style={{ marginTop: 10 }}>
            This will permanently delete your account and all saved items. This cannot be undone.
          </p>
          {deleteError && (
            <p className="delete-account-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="delete-account-modal-actions">
            <button
              className="btn-secondary"
              type="button"
              disabled={deleteBusy}
              onClick={closeDeleteConfirm}
            >
              Cancel
            </button>
            <button
              className="btn-delete-account-confirm"
              type="button"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteAccount()}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {user && (
        <ChangePasswordModal
          open={changePasswordOpen}
          user={user}
          onClose={() => setChangePasswordOpen(false)}
        />
      )}
    </div>
  );
}
