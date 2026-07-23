import { useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../firebase";
import Sidebar from "../components/Sidebar";

export default function CreateUser() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const secondaryApp = getApps().some((app) => app.name === "Secondary")
        ? getApp("Secondary")
        : initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        name,
        email,
        role,
        createdAt: serverTimestamp(),
      });

      await secondaryAuth.signOut();

      setMessage(`Successfully created account for ${name} (${role.replace("_", " ")})!`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("agent");
    } catch (err) {
      console.error(err);
      setError("Failed to create user. Make sure the password is at least 6 characters and the email is unique.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-bg flex">
      <Sidebar />

      <div className="flex-1 ml-[260px] p-8">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="page-title">Team Management</h1>
            <p className="page-subtitle">Generate a new portal account and assign their role.</p>
          </header>

          <div className="card p-8">
            {message && (
              <div className="bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan p-4 rounded-enterprise mb-6 font-semibold text-sm">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-accent-coral/15 border border-accent-coral/30 text-accent-coral p-4 rounded-enterprise mb-6 font-semibold text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-5">
              <div>
                <label className="label-field">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Temporary Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input-field"
                >
                  <option value="agent">Agent</option>
                  <option value="quality_supervisor">Quality Supervisor</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Creating..." : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
