import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { currentUser, loading, userProfile } = useAuth();

  useEffect(() => {
    if (!loading && currentUser) {
      const role = userProfile?.role;
      navigate(role === "team_lead" ? "/team-lead" : "/agent", { replace: true });
    }
  }, [currentUser, loading, userProfile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { user, error: loginError } = await loginUser(email, password);

    if (loginError || !user) {
      setError("Failed to log in. Please check your credentials.");
      setSubmitting(false);
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = userDoc.exists() ? userDoc.data().role : "agent";
    navigate(role === "team_lead" ? "/team-lead" : "/agent");
    setSubmitting(false);
  };

  return (
    <div className="page-bg flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-semibold text-text-main">Aamer CSR Portal</h1>
          <p className="text-text-muted mt-2 text-sm">Sign in to access the support system</p>
        </div>

        {error && (
          <div className="bg-accent-coral/15 border border-accent-coral/30 text-accent-coral p-3 rounded-enterprise mb-5 text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="label-field">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label-field">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
