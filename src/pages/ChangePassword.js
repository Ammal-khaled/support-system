import { useState } from "react";
import { signOut, updatePassword } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!auth.currentUser || !currentUser) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    setSubmitting(true);

    try {
      await updatePassword(auth.currentUser, password);
      await updateDoc(doc(db, "users", currentUser.uid), {
        mustChangePassword: false,
        passwordChangedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Password update failed:", err);
      setError(err.code === "auth/requires-recent-login"
        ? "Please sign out and sign in again before changing your password."
        : "Could not complete the password change. Please contact your team lead if this continues.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-bg flex min-h-screen items-center justify-center p-4">
      <main className="glass-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary text-sm font-extrabold text-white">
            AD
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
            Change Temporary Password
          </h1>
          <p className="mt-2 text-sm leading-6 text-semantic-neutral">
            Hi {userProfile?.name || "there"}, set your own password before entering AquaDesk.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3 text-sm font-semibold text-semantic-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label-field">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="label-field">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input-field"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Updating..." : "Set New Password"}
          </button>
        </form>
      </main>
    </div>
  );
}
