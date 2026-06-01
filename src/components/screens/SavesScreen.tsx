"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { removeSavedItem, setUserProfile, subscribeSavedItems } from "@/lib/firebase/firestore";
import type { SavedItem } from "@/lib/firebase/types";
import { onboardingIntroPath } from "@/lib/auth/onboardingStatus";

export function SavesScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.user?.uid || !auth?.isConfigured) {
      setItems([]);
      return;
    }
    const unsub = subscribeSavedItems(auth.user.uid, setItems);
    return () => unsub();
  }, [auth?.user?.uid, auth?.isConfigured]);

  const handleUnsave = useCallback(
    async (e: MouseEvent, item: SavedItem) => {
      e.stopPropagation();
      const id = item.id;
      if (!id || !auth?.user?.uid || !auth?.isConfigured || removingId) return;
      setListError(null);
      setRemovingId(id);
      try {
        await removeSavedItem(id);
        const prev = auth.profile?.savedCount ?? items.length;
        const next = Math.max(0, prev - 1);
        await setUserProfile(auth.user.uid, { savedCount: next });
        await auth.refreshProfile();
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Could not remove save");
      } finally {
        setRemovingId(null);
      }
    },
    [auth, items.length, removingId]
  );

  const isLoggedIn = !!auth?.user;
  const loading = auth?.loading ?? true;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="auth-legal">Loading…</p>
      </div>
    );
  }

  if (!isLoggedIn || !auth?.isConfigured) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="saves-header">
          <div className="saves-title">Saved</div>
          <div className="saves-count">Sign in to see your saves</div>
        </div>
        <div className="saves-empty">
          <div className="saves-empty-icon" aria-hidden>🔖</div>
          <p className="saves-empty-text">Your saved items will appear here.</p>
          <p className="saves-empty-sub">Create an account or sign in to save scans.</p>
          <button className="btn-primary" type="button" onClick={() => router.push(onboardingIntroPath("/saves"))} style={{ marginTop: 16 }}>
            Sign in / Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="saves-header">
        <div className="saves-title">Saved</div>
        <div className="saves-count">{items.length} item{items.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="saves-scroll">
        {listError && (
          <p className="auth-legal" style={{ color: "var(--red)", padding: "0 4px 8px" }}>
            {listError}
          </p>
        )}
        {items.length === 0 ? (
          <div className="saves-empty">
            <div className="saves-empty-icon" aria-hidden>🔖</div>
            <p className="saves-empty-text">No saved items yet.</p>
            <p className="saves-empty-sub">Scan an item and tap Save to add it here.</p>
            <button className="btn-primary" type="button" onClick={() => router.push("/scan")} style={{ marginTop: 16 }}>
              Scan an item
            </button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="save-card">
              <div
                className="save-card-main"
                onClick={() => router.push("/breakdown")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.push("/breakdown")}
              >
                <div className="save-swatch" aria-hidden>
                  👕
                </div>
                <div className="save-meta">
                  <div className="save-brand">{item.brandName}</div>
                  <div className="save-name">{item.itemName}</div>
                  <div className="save-tags">
                    {item.tags.map((t) => (
                      <span key={t} className={`save-tag ${item.verdict}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="save-card-side">
                <div className="save-price">${item.price}</div>
                <button
                  type="button"
                  className="save-card-unsave"
                  disabled={removingId === item.id}
                  onClick={(e) => handleUnsave(e, item)}
                >
                  {removingId === item.id ? "…" : "Unsave"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
