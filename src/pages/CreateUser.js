import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../firebase";
import Sidebar from "../components/Sidebar";
import { subscribeUsers, updateUserProfile } from "../services/firestore";

export default function CreateUser() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "agent", disabled: false });
  const [editingEmail, setEditingEmail] = useState("");
  const [savingUserId, setSavingUserId] = useState(null);
  const [userView, setUserView] = useState("active");
  const [roleFilter, setRoleFilter] = useState("all");
  const [query, setQuery] = useState("");

  const roleLabel = (value) => {
    if (value === "quality_supervisor") return "Quality Control";
    if (value === "team_lead") return "Team Lead";
    if (value === "disabled") return "Hidden";
    return "Agent";
  };

  const looksLikeEmail = (value) =>
    typeof value === "string" && value.includes("@");

  const getUserEmail = (user) =>
    user.email ||
    user.emailAddress ||
    user.authEmail ||
    user.loginEmail ||
    (looksLikeEmail(user.name) ? user.name : "");

  const getUserDisplayName = (user) =>
    user.name || getUserEmail(user) || "Unnamed User";

  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (rows) => {
        setUsers(rows);
        setLoadingUsers(false);
      },
      () => {
        setError("Unable to load users.");
        setLoadingUsers(false);
      }
    );

    return unsubscribe;
  }, []);

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
      await updateProfile(newUser, { displayName: name });

      await setDoc(doc(db, "users", newUser.uid), {
        name,
        email,
        role,
        mustChangePassword: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await secondaryAuth.signOut();

      setMessage(
        `Created ${name}. They must change their temporary password after first login.`
      );
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

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!editingUser) return;
    setSavingUserId(editingUser.id);
    setError("");
    setMessage("");

    try {
      const nextEmail = editingEmail.trim() || editForm.email.trim() || getUserEmail(editingUser);

      const updates = {
        name: editForm.name.trim(),
        role: editForm.disabled ? "disabled" : editForm.role,
        previousRole: editForm.disabled ? editForm.role : "",
        disabled: editForm.disabled,
      };

      if (nextEmail) {
        updates.email = nextEmail;
      }

      await updateUserProfile(editingUser.id, updates);
      setMessage(`Updated ${editForm.name || nextEmail}.`);
      setEditingUser(null);
      setEditingEmail("");
    } catch (updateError) {
      console.error(updateError);
      setError("Failed to update user profile.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeactivateUser = async (user) => {
    if (!window.confirm(`Deactivate ${getUserDisplayName(user)}? This removes portal access in AquaDesk but does not delete the Firebase Auth login.`)) return;
    setSavingUserId(user.id);
    setError("");

    try {
      await updateUserProfile(user.id, {
        role: "disabled",
        previousRole: user.role === "disabled" ? user.previousRole || "agent" : user.role || "agent",
        disabled: true,
      });
      setMessage(`Deactivated ${getUserDisplayName(user)}.`);
    } catch (deactivateError) {
      console.error(deactivateError);
      setError("Failed to deactivate user profile.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleReactivateUser = async (user) => {
    setSavingUserId(user.id);
    setError("");

    try {
      await updateUserProfile(user.id, {
        role: user.previousRole || "agent",
        previousRole: "",
        disabled: false,
      });
      setMessage(`Reactivated ${getUserDisplayName(user)}.`);
    } catch (reactivateError) {
      console.error(reactivateError);
      setError("Failed to reactivate user profile.");
    } finally {
      setSavingUserId(null);
    }
  };

  const visibleUsers = users.filter((user) => {
    const search = query.trim().toLowerCase();
    const isHidden = user.disabled || user.role === "disabled";
    const viewMatches = userView === "hidden" ? isHidden : !isHidden;
    const effectiveRole = user.role === "disabled" ? user.previousRole || "agent" : user.role;
    const roleMatches = roleFilter === "all" || effectiveRole === roleFilter;
    const matchesSearch = !search || [
      user.id,
      user.name,
      getUserEmail(user),
      roleLabel(effectiveRole),
      effectiveRole,
    ].some((field) => String(field || "").toLowerCase().includes(search));
    return viewMatches && roleMatches && matchesSearch;
  });

  return (
    <div className="page-bg flex">
      <Sidebar />

      <div className="min-h-screen flex-1 px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <h1 className="page-title">Team Management</h1>
            <p className="page-subtitle">Create portal accounts, review users, and update their AquaDesk roles.</p>
          </header>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="glass-card p-5 sm:p-8">
            {message && (
              <div className="bg-brand-faint/15 border border-brand-primary/30 text-brand-primary p-4 rounded-xl mb-6 font-semibold text-sm">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-semantic-error/15 border border-semantic-error/30 text-semantic-error p-4 rounded-xl mb-6 font-semibold text-sm">
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
                  <option value="quality_supervisor">Quality Control</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Creating..." : "Create Account"}
              </button>
            </form>
          </div>

          <div className="glass-card p-5 sm:p-8">
            <h2 className="text-xl font-extrabold text-slate-950">Existing Users</h2>
            <p className="mb-5 mt-1 text-sm text-semantic-neutral">
              Edit display details and roles. Deactivation blocks AquaDesk access through the app profile.
            </p>

            <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-start">
              <label>
                <span className="label-field">Search Team</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input-field mt-2"
                  placeholder="Search users by name, email, role, or ID..."
                />
              </label>
              <label>
                <span className="label-field">Role Filter</span>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="input-field mt-2"
                >
                  <option value="all">All roles</option>
                  <option value="agent">Agent</option>
                  <option value="quality_supervisor">Quality Control</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </label>
              <div>
                <span className="label-field">Account View</span>
                <div className="mt-4 flex gap-2 rounded-2xl border border-surface-border bg-surface-bg p-1">
                  {[
                    ["active", "Active"],
                    ["hidden", "Hidden"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setUserView(value)}
                      className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                        userView === value
                          ? "bg-brand-primary text-white"
                          : "text-semantic-neutral hover:bg-surface-card hover:text-brand-primary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="-mt-2 mb-5 text-xs font-semibold text-semantic-neutral">
              Hidden accounts are removed from operational dashboards.
            </p>
            {loadingUsers ? (
              <p className="text-semantic-neutral">Loading users...</p>
            ) : visibleUsers.length === 0 ? (
              <p className="text-semantic-neutral">No {userView} users match this filter.</p>
            ) : (
              <div className="space-y-3">
                {visibleUsers.map((user) => {
                  const displayEmail = getUserEmail(user);

                  return (
                  <article key={user.id} className="rounded-xl border border-surface-border bg-surface-bg p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-950">{getUserDisplayName(user)}</p>
                        <p className="text-sm text-semantic-neutral" data-user-email>{displayEmail || "No email on profile"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-surface-border bg-surface-card px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-semantic-neutral">
                            {roleLabel(user.role === "disabled" ? user.previousRole || "agent" : user.role)}
                          </span>
                          {user.disabled && (
                            <span className="rounded-full border border-semantic-error/30 bg-semantic-error/15 px-2.5 py-1 text-xs font-bold text-semantic-error">
                              Deactivated
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-profile-email={displayEmail}
                          onClick={(event) => {
                            const profileEmail = event.currentTarget.getAttribute("data-profile-email") || displayEmail;
                            const profileName = user.name || profileEmail;
                            const profileRole = user.role === "disabled" ? user.previousRole || "agent" : user.role || "agent";

                            setEditingUser({
                              ...user,
                              name: profileName,
                              email: profileEmail,
                            });
                            setEditingEmail(profileEmail);
                            setEditForm({
                              name: profileName,
                              email: profileEmail,
                              role: profileRole,
                              disabled: Boolean(user.disabled),
                            });
                          }}
                          className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm font-semibold text-slate-900 hover:border-brand-primary"
                        >
                          Edit
                        </button>
                        <button type="button" disabled={savingUserId === user.id || user.disabled} onClick={() => handleDeactivateUser(user)} className="rounded-xl bg-semantic-error px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          Deactivate
                        </button>
                        {userView === "hidden" && (
                          <button type="button" disabled={savingUserId === user.id} onClick={() => handleReactivateUser(user)} className="rounded-xl bg-semantic-success px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={handleUpdateUser} className="w-full max-w-xl rounded-card border border-surface-border bg-surface-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">Edit User</h2>
                <p className="text-sm text-semantic-neutral">Update the AquaDesk profile and role.</p>
              </div>
              <button type="button" onClick={() => { setEditingUser(null); setEditingEmail(""); }} className="rounded-full px-3 py-2 text-sm font-bold text-semantic-neutral hover:bg-surface-panel">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">Full Name</label>
                <input value={editForm.name || getUserDisplayName(editingUser)} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="input-field" required />
              </div>
              <div>
                <label className="label-field">Email Address</label>
                <div className="rounded-xl border border-surface-border bg-surface-bg px-4 py-3 text-sm font-semibold text-semantic-neutral">
                  Email stays unchanged for this account.
                </div>
              </div>
              <div>
                <label className="label-field">System Role</label>
                <select value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))} className="input-field" disabled={editForm.disabled}>
                  <option value="agent">Agent</option>
                  <option value="quality_supervisor">Quality Control</option>
                  <option value="team_lead">Team Lead</option>
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-bg px-4 py-3 text-sm font-semibold text-slate-900">
                <input
                  type="checkbox"
                  checked={editForm.disabled}
                  onChange={(event) => setEditForm((current) => ({
                    ...current,
                    disabled: event.target.checked,
                    role: !event.target.checked && current.role === "disabled" ? "agent" : current.role,
                  }))}
                />
                Deactivate AquaDesk access
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditingUser(null); setEditingEmail(""); }} className="btn-secondary px-4 text-sm font-bold">
                Cancel
              </button>
              <button type="submit" disabled={savingUserId === editingUser.id} className="btn-primary px-6 text-sm">
                {savingUserId === editingUser.id ? "Saving..." : "Save User"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

