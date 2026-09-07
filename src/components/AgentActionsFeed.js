import { useEffect, useState } from "react";
import { subscribeAgentActions } from "../services/firestore";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return "Pending";
  return timestamp.toDate().toLocaleString();
}

export default function AgentActionsFeed() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeAgentActions(
      (data) => {
        setActions(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load agent actions.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="card-header">Agent Action Log</h2>
        <p className="card-subtext">Recent selections from the agent action panel.</p>
      </div>

      {loading ? (
        <p className="text-semantic-neutral">Loading actions...</p>
      ) : error ? (
        <p className="text-semantic-error text-sm font-semibold">{error}</p>
      ) : actions.length === 0 ? (
        <p className="text-semantic-neutral">No agent actions logged yet.</p>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <article key={action.id} className="border border-surface-border rounded-xl p-4 bg-surface-bg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-sans font-semibold text-slate-900">{action.agentName || "Unknown Agent"}</p>
                  <p className="text-sm text-semantic-neutral mt-1">
                    Action: <span className="font-semibold text-brand-primary">{action.actionType}</span>
                  </p>
                </div>
                <p className="font-sans text-sm text-semantic-neutral text-right shrink-0">
                  {formatTimestamp(action.timestamp)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

