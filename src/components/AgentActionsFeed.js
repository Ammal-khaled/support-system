import { useEffect, useState } from "react";
import { subscribeAgentActions, subscribeUsers, updateAgentAction } from "../services/firestore";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return "Pending";
  return timestamp.toDate().toLocaleString();
}

export default function AgentActionsFeed({ externalSearchQuery = "", showSearch = true }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editingAction, setEditingAction] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [inactiveUserIds, setInactiveUserIds] = useState(new Set());
  const [editForm, setEditForm] = useState({
    actionType: "",
    note: "",
    responseNote: "",
    status: "open",
  });

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

  useEffect(() => {
    const unsubscribe = subscribeUsers((rows) => {
      setInactiveUserIds(new Set(rows
        .filter((user) => user.disabled || user.role === "disabled")
        .map((user) => user.id)));
    });

    return unsubscribe;
  }, []);

  const visibleActions = actions.filter((action) => {
    const search = (showSearch ? query : externalSearchQuery).trim().toLowerCase();
    const activeProfile = !action.agentId || !inactiveUserIds.has(action.agentId);
    const matchesSearch = !search || [
      action.id,
      action.agentId,
      action.agentName,
      action.actionType,
      action.note,
      action.responseNote,
      action.status,
      action.source,
    ].some((field) => String(field || "").toLowerCase().includes(search));

    return activeProfile && matchesSearch;
  });

  const openEditor = (action) => {
    setEditingAction(action);
    setEditForm({
      actionType: action.actionType || "",
      note: action.note || "",
      responseNote: action.responseNote || "",
      status: action.status || "open",
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingAction) return;
    setSavingId(editingAction.id);
    setError("");

    try {
      await updateAgentAction(editingAction.id, {
        actionType: editForm.actionType.trim(),
        note: editForm.note.trim(),
        responseNote: editForm.responseNote.trim(),
        status: editForm.status,
      });
      setEditingAction(null);
    } catch (saveError) {
      console.error("Failed to update support request:", saveError);
      setError("Unable to update support request.");
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusChange = async (action, status) => {
    setSavingId(action.id);
    setError("");

    try {
      await updateAgentAction(action.id, { status });
    } catch (saveError) {
      console.error("Failed to update support request:", saveError);
      setError("Unable to update support request.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="card-header">Support Request Log</h2>
        <p className="card-subtext">Recent help requests raised by agents during customer conversations.</p>
      </div>

      {showSearch && (
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field"
          placeholder="Search by agent, request, note, status, or ID..."
        />
      </div>
      )}

      {loading ? (
        <p className="text-semantic-neutral">Loading actions...</p>
      ) : error ? (
        <p className="text-semantic-error text-sm font-semibold">{error}</p>
            ) : visibleActions.length === 0 ? (
              <p className="text-semantic-neutral">No support requests match this search.</p>
            ) : (
        <div className="space-y-3">
          {visibleActions.map((action) => {
            const status = action.status || "open";

            return (
              <article key={action.id} className="border border-surface-border rounded-xl p-4 bg-surface-bg">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="font-sans font-semibold text-slate-900">{action.agentName || "Unknown Agent"}</p>
                      <span className="rounded-full border border-surface-border bg-surface-card px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-semantic-neutral">
                        {status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-semantic-neutral">
                      Needs support with: <span className="font-semibold text-brand-primary">{action.actionType || "Unlabeled request"}</span>
                    </p>
                    {action.note && (
                      <p className="mt-2 text-sm text-slate-900">
                        {action.note}
                      </p>
                    )}
                    {action.responseNote && (
                      <p className="mt-2 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm text-semantic-neutral">
                        Response: {action.responseNote}
                      </p>
                    )}
                    <p className="font-sans text-sm text-semantic-neutral mt-2">{formatTimestamp(action.timestamp)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openEditor(action)}
                      className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm font-semibold text-slate-900 hover:border-brand-primary hover:bg-surface-panel"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={savingId === action.id}
                      onClick={() => handleStatusChange(action, "in_progress")}
                      className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary disabled:opacity-50"
                    >
                      In Progress
                    </button>
                    <button
                      type="button"
                      disabled={savingId === action.id}
                      onClick={() => handleStatusChange(action, "resolved")}
                      className="rounded-xl bg-semantic-success px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={handleSave} className="w-full max-w-2xl rounded-card border border-surface-border bg-surface-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-950">Edit Support Request</h3>
                <p className="text-sm text-semantic-neutral">Update the request label and track how the team responded.</p>
              </div>
              <button type="button" onClick={() => setEditingAction(null)} className="rounded-full px-3 py-2 text-sm font-bold text-semantic-neutral hover:bg-surface-panel">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">Support Area</label>
                <input
                  value={editForm.actionType}
                  onChange={(event) => setEditForm((current) => ({ ...current, actionType: event.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field">Agent Note</label>
                <textarea
                  value={editForm.note}
                  onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))}
                  rows={3}
                  className="input-field resize-y"
                />
              </div>
              <div>
                <label className="label-field">Team Response</label>
                <textarea
                  value={editForm.responseNote}
                  onChange={(event) => setEditForm((current) => ({ ...current, responseNote: event.target.value }))}
                  rows={3}
                  className="input-field resize-y"
                />
              </div>
              <div>
                <label className="label-field">Status</label>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                  className="input-field"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingAction(null)} className="btn-secondary px-4 text-sm font-bold">
                Cancel
              </button>
              <button type="submit" disabled={savingId === editingAction.id} className="btn-primary px-6 text-sm">
                {savingId === editingAction.id ? "Saving..." : "Save Request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

