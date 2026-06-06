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
  type DeleteFlowStep = null | "retention" | "confirm";
  type RetentionOffer = {
    show: boolean;
    offerPlan: "monthly" | "yearly" | "weekly";
    title: string;
    description: string;
    cta: string;
  };

  const [deleteFlowStep, setDeleteFlowStep] = useState<DeleteFlowStep>(null);
  const [retentionOffer, setRetentionOffer] = useState<RetentionOffer | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [switchPlanBusy, setSwitchPlanBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const closeDeleteFlow = () => {
    if (deleteBusy || switchPlanBusy) return;
    setDeleteFlowStep(null);
    setRetentionOffer(null);
    setDeleteError(null);
    setDeleteConfirmText("");
  };

  const openDeleteFlow = async () => {
    if (!user) return;
    setDeleteError(null);
    setDeleteConfirmText("");
    setRetentionOffer(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/delete-account/preflight", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { retentionOffer?: RetentionOffer | null };
      if (data.retentionOffer?.show) {
        setRetentionOffer(data.retentionOffer);
        setDeleteFlowStep("retention");
      } else {
        setDeleteFlowStep("confirm");
      }
    } catch {
      setDeleteFlowStep("confirm");
    }
  };

  const switchToRetentionPlan = async () => {
    if (!user || !retentionOffer) return;
    setSwitchPlanBusy(true);
    setDeleteError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/subscription/switch-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: retentionOffer.offerPlan,
          source: "delete_account_retention"
        })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not switch plan");
      await auth?.refreshProfile();
      closeDeleteFlow();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not switch plan");
    } finally {
      setSwitchPlanBusy(false);
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
      </div>

      <div className="profile-logout-area">
        <button
          className="btn-logout"
          type="button"
          disabled={deleteBusy}
          onClick={async () => {
            await auth?.signOut();
          }}
        >
          ← Log Out
        </button>

        {!TESTING_ALWAYS_SHOW_LOGGED_IN && (
          <button
            className="btn-delete-account"
            type="button"
            disabled={deleteBusy || switchPlanBusy}
            onClick={() => void openDeleteFlow()}
          >
            Delete account
          </button>
        )}
      </div>

      <div
        className={`share-modal ${deleteFlowStep ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={deleteFlowStep === "retention" ? "retention-offer-title" : "delete-account-title"}
        onClick={closeDeleteFlow}
      >
        <div className="share-modal-inner" onClick={(e) => e.stopPropagation()}>
          {deleteFlowStep === "retention" && retentionOffer ? (
            <>
              <h2 id="retention-offer-title" className="pw-modal-title" style={{ marginTop: 0 }}>
                {retentionOffer.title}
              </h2>
              <p className="pw-modal-sub" style={{ marginTop: 10 }}>
                {retentionOffer.description}
              </p>
              {deleteError && (
                <p className="delete-account-error" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="delete-account-modal-actions delete-account-modal-actions--stack">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={switchPlanBusy || deleteBusy}
                  onClick={() => void switchToRetentionPlan()}
                >
                  {switchPlanBusy ? "Switching…" : retentionOffer.cta}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={switchPlanBusy || deleteBusy}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteFlowStep("confirm");
                  }}
                >
                  No thanks, delete my account
                </button>
                <button
                  className="btn-delete-account-link"
                  type="button"
                  disabled={switchPlanBusy || deleteBusy}
                  onClick={closeDeleteFlow}
                >
                  Keep my account
                </button>
              </div>
            </>
          ) : deleteFlowStep === "confirm" ? (
            <>
              <h2 id="delete-account-title" className="pw-modal-title" style={{ marginTop: 0 }}>
                Delete your account?
              </h2>
              <p className="pw-modal-sub" style={{ marginTop: 10 }}>
                This permanently removes your profile, saved items, and scan history. Active Buffi Pro
                subscriptions will be canceled. This cannot be undone.
              </p>
              <p className="auth-legal" style={{ marginTop: 16 }}>
                Type <strong>DELETE</strong> to confirm
              </p>
              <input
                className="delete-account-confirm-input"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                disabled={deleteBusy}
                aria-label="Type DELETE to confirm account deletion"
              />
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
                  onClick={closeDeleteFlow}
                >
                  Cancel
                </button>
                <button
                  className="btn-delete-account-confirm"
                  type="button"
                  disabled={deleteBusy || deleteConfirmText.trim() !== "DELETE"}
                  onClick={async () => {
                    if (!user || deleteConfirmText.trim() !== "DELETE") return;
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
                      closeDeleteFlow();
                      try {
                        await auth?.signOut();
                      } catch {
                        /* auth user may already be removed server-side */
                        router.replace("/signin");
                      }
                    } catch (e) {
                      setDeleteError(e instanceof Error ? e.message : "Could not delete account");
                    } finally {
                      setDeleteBusy(false);
                    }
                  }}
                >
                  {deleteBusy ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </>
          ) : null}
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

