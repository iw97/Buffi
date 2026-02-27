"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { subscribeSavedItems } from "@/lib/firebase/firestore";
import type { SavedItem } from "@/lib/firebase/types";

export function SavesScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    if (!auth?.user?.uid || !auth?.isConfigured) {
      setItems([]);
      return;
    }
    const unsub = subscribeSavedItems(auth.user.uid, setItems);
    return () => unsub();
  }, [auth?.user?.uid, auth?.isConfigured]);

  const isLoggedIn = !!auth?.user;
  const loading = auth?.loading ?? false;

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
          <button className="btn-primary" type="button" onClick={() => router.push("/onboarding/account")} style={{ marginTop: 16 }}>
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
            <div
              key={item.id}
              className="save-card"
              onClick={() => router.push("/breakdown")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && router.push("/breakdown")}
            >
              <div className="save-swatch" aria-hidden>
                {item.emoji ?? "👕"}
              </div>
              <div className="save-meta">
                <div className="save-brand">{item.brand}</div>
                <div className="save-name">{item.name}</div>
                <div className="save-tags">
                  {item.tags.map((t) => (
                    <span key={t.label} className={`save-tag ${t.type}`}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="save-price">${item.retailPrice}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

