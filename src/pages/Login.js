import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function destinationForRole(role) {
  if (role === "team_lead") return "/team-lead";
  if (role === "quality_supervisor") return "/quality";
  if (role === "disabled") return "/login";
  return "/agent";
}

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
      if (role === "disabled" || userProfile?.disabled) {
        setError("This account has been deactivated. Contact your team lead.");
        return;
      }
      navigate(destinationForRole(role), { replace: true });
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
    const profile = userDoc.exists() ? userDoc.data() : { role: "agent" };
    if (profile.role === "disabled" || profile.disabled) {
      setError("This account has been deactivated. Contact your team lead.");
      setSubmitting(false);
      return;
    }
    if (profile.mustChangePassword) {
      navigate("/change-password");
    } else {
      navigate(destinationForRole(profile.role));
    }
    setSubmitting(false);
  };

  return (
    <div className="page-bg flex min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-[980px] overflow-hidden lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-8 inline-flex rounded-2xl bg-white p-3">
              <img
                src="https://aquacool.me/images/logo.png"
                alt="Aquacool Metering"
                className="h-12 w-auto object-contain"
              />
            </div>
            <h1 className="max-w-sm text-4xl font-extrabold leading-tight tracking-tight">
              AquaDesk
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Aquacool support operations, knowledge workflows, and agent guidance in one workspace.
            </p>
          </div>

        </section>

        <section className="p-8 md:p-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-white p-3 lg:hidden">
            <img
              src="https://aquacool.me/images/logo.png"
              alt="Aquacool Metering"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="font-sans text-3xl font-extrabold tracking-tight text-slate-950">
            AquaDesk
          </h1>
          <p className="text-semantic-neutral mt-2 text-sm">
            Sign in to access Aquacool support operations.
          </p>
        </div>

        {error && (
          <div className="bg-semantic-error/15 border border-semantic-error/30 text-semantic-error p-3 rounded-xl mb-5 text-sm font-semibold">
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
        </section>
      </div>
    </div>
  );
}

