import { useEffect, useState } from "react";
import { getActionTypeName, logAgentAction, subscribeActionTypes } from "../services/firestore";
import { useAuth } from "../context/AuthContext";

export default function ActionSelector() {
  const { currentUser, userProfile } = useAuth();
  const [actionTypes, setActionTypes] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loggingId, setLoggingId] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeActionTypes(
      setActionTypes,
      () => setError("Unable to load action types.")
    );

    return unsubscribe;
  }, []);

  const handleLogAction = async (actionType) => {
    if (!currentUser || loggingId) return;

    const actionName = getActionTypeName(actionType);
    setLoggingId(actionType.id);
    setError("");

    try {
      const agentName =
        userProfile?.name || currentUser.displayName || currentUser.email || "Unknown Agent";

      await logAgentAction({
        agentId: currentUser.uid,
        agentName,
        actionType: actionName,
      });

      setMessage(`Logged: ${actionName}`);
      window.setTimeout(() => setMessage(""), 2200);
    } catch (err) {
      console.error("Failed to log action:", err);
      setError("Failed to log action.");
    } finally {
      setLoggingId(null);
    }
  };

  return (
    <section className="card p-6 mb-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="card-header">Quick Actions</h2>
          <p className="card-subtext">Log the action you are taking on this call.</p>
        </div>
        {message && (
          <span className="text-sm font-semibold text-accent-emerald bg-accent-emerald/15 border border-accent-emerald/30 px-3 py-1.5 rounded-full">
            {message}
          </span>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-accent-coral mb-3">{error}</p>}

      {actionTypes.length === 0 ? (
        <p className="text-text-muted">No action types configured yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {actionTypes.map((actionType) => {
            const actionName = getActionTypeName(actionType);

            return (
              <button
                key={actionType.id}
                type="button"
                disabled={Boolean(loggingId)}
                onClick={() => handleLogAction(actionType)}
                className="min-h-[82px] rounded-enterprise border border-mission-border bg-mission-bg
                           hover:border-accent-cyan hover:shadow-soft-dark
                           transition-all text-left p-4 disabled:opacity-50"
              >
                <span className="block font-display text-base font-semibold text-text-main">{actionName}</span>
                <span className="block text-xs font-semibold text-text-muted mt-1">
                  {loggingId === actionType.id ? "Logging..." : "Log action"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
