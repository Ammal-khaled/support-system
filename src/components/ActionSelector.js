import { useEffect, useState } from "react";
import { getActionTypeName, logAgentAction, subscribeActionTypes } from "../services/firestore";
import { useAuth } from "../context/AuthContext";

const FALLBACK_ACTION_TYPES = [
  { id: "fallback-billing", name: "Billing Inquiry", fallback: true },
  { id: "fallback-refund", name: "Refund Request", fallback: true },
  { id: "fallback-move-in", name: "Move In Support", fallback: true },
  { id: "fallback-move-out", name: "Move Out Support", fallback: true },
];

export default function ActionSelector() {
  const { currentUser, userProfile } = useAuth();
  const [actionTypes, setActionTypes] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loggingId, setLoggingId] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeActionTypes(
      (items) => {
        setActionTypes(items.length ? items : FALLBACK_ACTION_TYPES);
        setError("");
      },
      () => {
        setActionTypes(FALLBACK_ACTION_TYPES);
        setError("Using default quick actions until saved action types are available.");
      }
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
        source: actionType.fallback ? "default_quick_action" : "configured_quick_action",
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
    <section className="glass-card p-4 mb-6 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="card-header">Quick Actions</h2>
          <p className="card-subtext">Log the action you are taking on this call.</p>
        </div>
        {message && (
          <span className="text-sm font-semibold text-semantic-success bg-semantic-success/15 border border-semantic-success/30 px-3 py-1.5 rounded-full">
            {message}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-2xl border border-semantic-warning/30 bg-semantic-warning/10 px-3 py-2 text-sm font-semibold text-semantic-warning">
          {error}
        </p>
      )}

      {actionTypes.length === 0 ? (
        <p className="text-semantic-neutral">Quick actions are loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actionTypes.map((actionType) => {
            const actionName = getActionTypeName(actionType);

            return (
              <button
                key={actionType.id}
                type="button"
                disabled={Boolean(loggingId)}
                onClick={() => handleLogAction(actionType)}
                className="min-h-[82px] rounded-2xl border border-surface-border bg-surface-panel
                           p-4 text-left transition-all
                           hover:border-brand-primary hover:bg-surface-card hover:shadow-card
                           disabled:opacity-50"
              >
                <span className="block font-sans text-base font-semibold text-current">{actionName}</span>
                <span className="block text-xs font-semibold text-semantic-neutral mt-1">
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

