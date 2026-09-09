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
  const [customTopic, setCustomTopic] = useState("");
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeActionTypes(
      (items) => {
        setActionTypes(items.length ? items : FALLBACK_ACTION_TYPES);
        setError("");
      },
      () => {
        setActionTypes(FALLBACK_ACTION_TYPES);
        setError("Using default support topics until saved support types are available.");
      }
    );

    return unsubscribe;
  }, []);

  const submitSupportRequest = async ({ actionName, note = "", source, loggingKey }) => {
    if (!currentUser || loggingId) return;

    setLoggingId(loggingKey);
    setError("");

    try {
      const agentName =
        userProfile?.name || currentUser.displayName || currentUser.email || "Unknown Agent";

      await logAgentAction({
        agentId: currentUser.uid,
        agentName,
        actionType: actionName,
        note,
        source,
      });

      setMessage(`Support requested: ${actionName}`);
      setCustomTopic("");
      setCustomNote("");
      window.setTimeout(() => setMessage(""), 2200);
    } catch (err) {
      console.error("Failed to log action:", err);
      setError("Failed to send support request.");
    } finally {
      setLoggingId(null);
    }
  };

  const handleLogAction = async (actionType) => {
    const actionName = getActionTypeName(actionType);
    await submitSupportRequest({
      actionName,
      source: actionType.fallback ? "default_quick_action" : "configured_quick_action",
      loggingKey: actionType.id,
    });
  };

  const handleCustomSubmit = async (event) => {
    event.preventDefault();
    const actionName = customTopic.trim();
    if (!actionName) return;
    await submitSupportRequest({
      actionName,
      note: customNote.trim(),
      source: "agent_custom_request",
      loggingKey: "custom",
    });
  };

  return (
    <section className="glass-card p-4 mb-6 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="card-header">Request Support</h2>
          <p className="card-subtext">Raise the area where you need help right now so your team lead or quality reviewer can respond.</p>
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
        <p className="text-semantic-neutral">Support topics are loading...</p>
      ) : (
        <>
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
                    {loggingId === actionType.id ? "Requesting..." : "Need support"}
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCustomSubmit} className="mt-4 rounded-2xl border border-surface-border bg-surface-bg p-4">
            <label className="label-field">Custom Support Request</label>
            <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <input
                type="text"
                value={customTopic}
                onChange={(event) => setCustomTopic(event.target.value)}
                className="input-field"
                placeholder="e.g. refund approval, billing issue, customer angry"
              />
              <input
                type="text"
                value={customNote}
                onChange={(event) => setCustomNote(event.target.value)}
                className="input-field"
                placeholder="Optional note for the team lead"
              />
              <button type="submit" disabled={Boolean(loggingId) || !customTopic.trim()} className="btn-primary px-5 text-sm">
                {loggingId === "custom" ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

