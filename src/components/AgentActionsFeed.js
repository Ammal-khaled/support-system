import { useEffect, useState } from "react";
import {
  subscribeAgentActions,
  subscribeUsers,
  updateAgentAction,
} from "../services/firestore";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return "Pending";
  }

  return timestamp.toDate().toLocaleString();
}

export default function AgentActionsFeed({
  externalSearchQuery = "",
  showSearch = true,
}) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [editingAction, setEditingAction] =
    useState(null);

  const [savingId, setSavingId] = useState(null);

  const [inactiveUserIds, setInactiveUserIds] =
    useState(new Set());

  const [editForm, setEditForm] = useState({
    actionType: "",
    note: "",
    responseNote: "",
    status: "open",
  });

  // Listen for support requests
  useEffect(() => {
    const unsubscribe = subscribeAgentActions(
      (data) => {
        setActions(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError(
          "Unable to load agent actions."
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Listen for active/inactive users
  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (rows) => {
        setInactiveUserIds(
          new Set(
            rows
              .filter(
                (user) =>
                  user.disabled ||
                  user.role === "disabled"
              )
              .map((user) => user.id)
          )
        );
      }
    );

    return unsubscribe;
  }, []);

  /*
   * Only show:
   * - Active agents
   * - Non-resolved support requests
   * - Results matching the current search
   */
  const visibleActions = actions.filter(
    (action) => {
      const search = (
        showSearch
          ? query
          : externalSearchQuery
      )
        .trim()
        .toLowerCase();

      const activeProfile =
        !action.agentId ||
        !inactiveUserIds.has(
          action.agentId
        );

      // Normalize status before checking it
      const status = String(
        action.status || "open"
      )
        .trim()
        .toLowerCase();

      // Resolved requests should disappear
      const isUnresolved =
        status !== "resolved";

      const matchesSearch =
        !search ||
        [
          action.id,
          action.agentId,
          action.agentName,
          action.actionType,
          action.note,
          action.responseNote,
          action.status,
          action.source,
        ].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(search)
        );

      return (
        activeProfile &&
        isUnresolved &&
        matchesSearch
      );
    }
  );

  const openEditor = (action) => {
    setEditingAction(action);

    setEditForm({
      actionType:
        action.actionType || "",
      note: action.note || "",
      responseNote:
        action.responseNote || "",
      status:
        String(action.status || "open")
          .trim()
          .toLowerCase(),
    });
  };

  /*
   * Save request after editing
   */
  const handleSave = async (event) => {
    event.preventDefault();

    if (!editingAction) {
      return;
    }

    setSavingId(editingAction.id);
    setError("");

    const previousActions = actions;

    const normalizedStatus = String(
      editForm.status || "open"
    )
      .trim()
      .toLowerCase();

    // Update UI immediately
    setActions((current) =>
      current.map((item) =>
        item.id === editingAction.id
          ? {
              ...item,
              actionType:
                editForm.actionType.trim(),
              note: editForm.note.trim(),
              responseNote:
                editForm.responseNote.trim(),
              status: normalizedStatus,
            }
          : item
      )
    );

    try {
      await updateAgentAction(
        editingAction.id,
        {
          actionType:
            editForm.actionType.trim(),

          note:
            editForm.note.trim(),

          responseNote:
            editForm.responseNote.trim(),

          status: normalizedStatus,
        }
      );

      setEditingAction(null);
    } catch (saveError) {
      console.error(
        "Failed to update support request:",
        saveError
      );

      // Restore previous state if Firebase fails
      setActions(previousActions);

      setError(
        "Unable to update support request."
      );
    } finally {
      setSavingId(null);
    }
  };

  /*
   * Change status:
   * Open / In Progress / Resolved
   */
  const handleStatusChange = async (
    action,
    status
  ) => {
    setSavingId(action.id);
    setError("");

    const normalizedStatus = String(status)
      .trim()
      .toLowerCase();

    // Keep backup in case Firebase update fails
    const previousActions = actions;

    /*
     * Update React state immediately.
     *
     * If status becomes "resolved",
     * visibleActions will immediately remove
     * the card from the screen.
     */
    setActions((current) =>
      current.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: normalizedStatus,
            }
          : item
      )
    );

    try {
      await updateAgentAction(
        action.id,
        {
          status: normalizedStatus,
        }
      );
    } catch (saveError) {
      console.error(
        "Failed to update support request:",
        saveError
      );

      /*
       * Firebase failed, so restore the
       * previous request list.
       */
      setActions(previousActions);

      setError(
        "Unable to update support request."
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="card-header">
          Support Request Log
        </h2>

        <p className="card-subtext">
          Recent help requests raised by
          agents during customer
          conversations.
        </p>
      </div>

      {/* Local Search */}
      {showSearch && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            className="input-field"
            placeholder="Search by agent, request, note, status, or ID..."
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-semantic-neutral">
          Loading actions...
        </p>
      ) : error ? (
        <p className="text-semantic-error text-sm font-semibold">
          {error}
        </p>
      ) : visibleActions.length === 0 ? (
        <p className="text-semantic-neutral">
          No open support requests match
          this search.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleActions.map(
            (action) => {
              const status = String(
                action.status || "open"
              )
                .trim()
                .toLowerCase();

              return (
                <article
                  key={action.id}
                  className="rounded-xl border border-surface-border bg-surface-bg p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Request information */}
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="font-sans font-semibold text-slate-900">
                          {action.agentName ||
                            "Unknown Agent"}
                        </p>

                        <span className="rounded-full border border-surface-border bg-surface-card px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-semantic-neutral">
                          {status.replace(
                            "_",
                            " "
                          )}
                        </span>
                      </div>

                      <p className="text-sm text-semantic-neutral">
                        Needs support with:{" "}
                        <span className="font-semibold text-brand-primary">
                          {action.actionType ||
                            "Unlabeled request"}
                        </span>
                      </p>

                      {action.note && (
                        <p className="mt-2 text-sm text-slate-900">
                          {action.note}
                        </p>
                      )}

                      {action.responseNote && (
                        <p className="mt-2 rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm text-semantic-neutral">
                          Response:{" "}
                          {
                            action.responseNote
                          }
                        </p>
                      )}

                      <p className="mt-2 font-sans text-sm text-semantic-neutral">
                        {formatTimestamp(
                          action.timestamp
                        )}
                      </p>
                    </div>

                    {/* Request Actions */}
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          openEditor(action)
                        }
                        disabled={
                          savingId === action.id
                        }
                        className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-sm font-semibold text-slate-900 hover:border-brand-primary hover:bg-surface-panel disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          savingId === action.id ||
                          status ===
                            "in_progress"
                        }
                        onClick={() =>
                          handleStatusChange(
                            action,
                            "in_progress"
                          )
                        }
                        className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary disabled:opacity-50"
                      >
                        {status ===
                        "in_progress"
                          ? "In Progress"
                          : "In Progress"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          savingId === action.id
                        }
                        onClick={() =>
                          handleStatusChange(
                            action,
                            "resolved"
                          )
                        }
                        className="rounded-xl bg-semantic-success px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingId === action.id
                          ? "Saving..."
                          : "Resolve"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-2xl rounded-card border border-surface-border bg-surface-card p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-950">
                  Edit Support Request
                </h3>

                <p className="text-sm text-semantic-neutral">
                  Update the request label
                  and track how the team
                  responded.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditingAction(null)
                }
                className="rounded-full px-3 py-2 text-sm font-bold text-semantic-neutral hover:bg-surface-panel"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {/* Support Area */}
              <div>
                <label className="label-field">
                  Support Area
                </label>

                <input
                  value={
                    editForm.actionType
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        actionType:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="input-field"
                  required
                />
              </div>

              {/* Agent Note */}
              <div>
                <label className="label-field">
                  Agent Note
                </label>

                <textarea
                  value={editForm.note}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        note:
                          event.target
                            .value,
                      })
                    )
                  }
                  rows={3}
                  className="input-field resize-y"
                />
              </div>

              {/* Team Response */}
              <div>
                <label className="label-field">
                  Team Response
                </label>

                <textarea
                  value={
                    editForm.responseNote
                  }
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        responseNote:
                          event.target
                            .value,
                      })
                    )
                  }
                  rows={3}
                  className="input-field resize-y"
                />
              </div>

              {/* Status */}
              <div>
                <label className="label-field">
                  Status
                </label>

                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="input-field"
                >
                  <option value="open">
                    Open
                  </option>

                  <option value="in_progress">
                    In Progress
                  </option>

                  <option value="resolved">
                    Resolved
                  </option>
                </select>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setEditingAction(null)
                }
                className="btn-secondary px-4 text-sm font-bold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  savingId ===
                  editingAction.id
                }
                className="btn-primary px-6 text-sm"
              >
                {savingId ===
                editingAction.id
                  ? "Saving..."
                  : "Save Request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
