"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { useChangePassword } from "@/hooks/useChangePassword";

type Props = {
  open: boolean;
  user: User;
  onClose: () => void;
};

export function ChangePasswordModal({ open, user, onClose }: Props) {
  const { changePassword } = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    if (busy) return;
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Fill in all fields");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setBusy(true);
    try {
      await changePassword(user, currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`share-modal ${open ? "open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onClick={handleClose}
    >
      <div className="share-modal-inner" onClick={(e) => e.stopPropagation()}>
        <h2 id="change-password-title" className="pw-modal-title" style={{ marginTop: 0 }}>
          Change password
        </h2>
        <p className="pw-modal-sub" style={{ marginTop: 10 }}>
          Enter your current password, then choose a new one.
        </p>

        <div className="auth-input-wrap" style={{ marginTop: 20 }}>
          <div className="auth-input-label">Current password</div>
          <input
            className="auth-input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="auth-input-wrap">
          <div className="auth-input-label">New password</div>
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="auth-input-wrap">
          <div className="auth-input-label">Confirm new password</div>
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
          />
        </div>

        {success && (
          <p className="auth-legal" style={{ color: "var(--teal)", marginTop: 12 }}>
            Password updated.
          </p>
        )}

        {error && (
          <p className="delete-account-error" role="alert">
            {error}
          </p>
        )}

        <div className="delete-account-modal-actions" style={{ marginTop: 20 }}>
          <button className="btn-secondary" type="button" disabled={busy} onClick={handleClose}>
            {success ? "Done" : "Cancel"}
          </button>
          <button className="btn-primary" type="button" disabled={busy} onClick={() => void handleSubmit()}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </div>
  );
}
