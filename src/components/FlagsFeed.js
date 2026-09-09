import { useEffect, useState } from "react";
import { deleteFlag, markFlagReviewed, subscribeFlags, subscribeUsers, updateFlagReview } from "../services/firestore";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return "Pending";
  return timestamp.toDate().toLocaleString();
}

export default function FlagsFeed({ typeFilter = "all", externalSearchQuery = "", showSearch = true }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reviewingId, setReviewingId] = useState(null);
  const [inactiveUserIds, setInactiveUserIds] = useState(new Set());
  const [editingFlag, setEditingFlag] = useState(null);
  const [editForm, setEditForm] = useState({
    type: "soft_skill",
    matchedPhrase: "",
    transcriptSnippet: "",
    feedback: "",
  });

  useEffect(() => {
    const unsubscribe = subscribeFlags(
      (data) => {
        setFlags(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load flags.");
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

  const handleMarkReviewed = async (flagId) => {
    setReviewingId(flagId);
    try {
      await markFlagReviewed(flagId);
    } finally {
      setReviewingId(null);
    }
  };

  const openEditor = (flag) => {
    setEditingFlag(flag);
    setEditForm({
      type: flag.type || "soft_skill",
      matchedPhrase: flag.matchedPhrase || "",
      transcriptSnippet: flag.transcriptSnippet || "",
      feedback: flag.feedback || "",
    });
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editingFlag) return;
    setReviewingId(editingFlag.id);
    try {
      await updateFlagReview(editingFlag.id, {
        type: editForm.type,
        matchedPhrase: editForm.matchedPhrase.trim(),
        transcriptSnippet: editForm.transcriptSnippet.trim(),
        feedback: editForm.feedback.trim(),
      });
      setEditingFlag(null);
    } finally {
      setReviewingId(null);
    }
  };

  const handleDelete = async () => {
    if (!editingFlag) return;
    if (!window.confirm(`Delete flag "${editingFlag.matchedPhrase || "quality flag"}"? This cannot be undone.`)) return;
    setReviewingId(editingFlag.id);
    try {
      await deleteFlag(editingFlag.id);
      setEditingFlag(null);
    } finally {
      setReviewingId(null);
    }
  };

  const activeFlags = flags.filter((flag) => !flag.agentId || !inactiveUserIds.has(flag.agentId));
  const visibleFlags = activeFlags.filter((flag) => {
    const search = (showSearch ? query : externalSearchQuery).trim().toLowerCase();
    const matchesType = typeFilter === "all" || flag.type === typeFilter;
    const matchesSearch = !search || [
      flag.id,
      flag.agentId,
      flag.agentName,
      flag.type,
      flag.matchedPhrase,
      flag.transcriptSnippet,
      flag.feedback,
      flag.source,
      flag.reviewed ? "reviewed" : "open",
    ].some((field) => String(field || "").toLowerCase().includes(search));

    return matchesType && matchesSearch;
  });
  const openCount = visibleFlags.filter((flag) => !flag.reviewed).length;
  const feedLabel = typeFilter === "critical"
    ? "Critical Flag Feed"
    : typeFilter === "soft_skill"
      ? "Soft-Skill Flag Feed"
      : "Live Flag Feed";

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="card-header">{feedLabel}</h2>
          <p className="card-subtext">Real-time critical and soft-skill observations.</p>
        </div>
        <span className="font-sans text-sm font-semibold text-brand-primary bg-surface-bg border border-surface-border px-3 py-1.5 rounded-full">
          {openCount} open
        </span>
      </div>

      {showSearch && (
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field"
          placeholder="Search by agent, phrase, transcript, status, or ID..."
        />
      </div>
      )}

      {loading ? (
        <p className="text-semantic-neutral">Loading flags...</p>
      ) : error ? (
        <p className="text-semantic-error text-sm font-semibold">{error}</p>
      ) : activeFlags.length === 0 ? (
        <p className="text-semantic-neutral">No flags logged yet.</p>
      ) : visibleFlags.length === 0 ? (
        <p className="text-semantic-neutral">No {typeFilter === "critical" ? "critical" : "soft-skill"} flags match this view.</p>
      ) : (
        <div className="space-y-3">
          {visibleFlags.map((flag) => {
            const isCritical = flag.type === "critical";

            return (
              <article key={flag.id} className="border border-surface-border rounded-xl p-4 bg-surface-bg">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          isCritical
                            ? "bg-semantic-error/15 text-semantic-error border border-semantic-error/30"
                            : "bg-semantic-warning/15 text-semantic-warning border border-semantic-warning/30"
                        }`}
                      >
                        {isCritical ? "Critical" : "Soft Skill"}
                      </span>
                      {flag.reviewed && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-semantic-success/15 text-semantic-success border border-semantic-success/30">
                          Reviewed
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-900">
                        {flag.agentName || "Unknown Agent"}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900">
                      Matched: &ldquo;{flag.matchedPhrase || "Unknown phrase"}&rdquo;
                    </p>
                    {flag.transcriptSnippet && (
                      <p className="text-sm text-semantic-neutral mt-2 italic border-l-2 border-surface-border pl-3">
                        &ldquo;{flag.transcriptSnippet}&rdquo;
                      </p>
                    )}
                    {flag.feedback && (
                      <p className="text-sm text-semantic-neutral mt-2">
                        {flag.feedback}
                      </p>
                    )}
                    <p className="font-sans text-sm text-semantic-neutral mt-2">{formatTimestamp(flag.timestamp)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(flag)}
                      className="px-3 py-2 rounded-xl border border-surface-border bg-surface-card text-sm font-semibold text-slate-900 hover:border-brand-primary hover:bg-surface-panel transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={flag.reviewed || reviewingId === flag.id}
                      onClick={() => handleMarkReviewed(flag.id)}
                      className="px-3 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {flag.reviewed ? "Reviewed" : reviewingId === flag.id ? "Saving..." : "Mark Reviewed"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={handleSaveEdit} className="w-full max-w-2xl rounded-card border border-surface-border bg-surface-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-950">Edit Quality Flag</h3>
                <p className="text-sm text-semantic-neutral">Correct the review category or note before closing the quality item.</p>
              </div>
              <button type="button" onClick={() => setEditingFlag(null)} className="rounded-full px-3 py-2 text-sm font-bold text-semantic-neutral hover:bg-surface-panel">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">Flag Type</label>
                <select
                  value={editForm.type}
                  onChange={(event) => setEditForm((current) => ({ ...current, type: event.target.value }))}
                  className="input-field"
                >
                  <option value="critical">Critical</option>
                  <option value="soft_skill">Soft Skill</option>
                </select>
              </div>
              <div>
                <label className="label-field">Matched Phrase</label>
                <input
                  value={editForm.matchedPhrase}
                  onChange={(event) => setEditForm((current) => ({ ...current, matchedPhrase: event.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Transcript Snippet</label>
                <textarea
                  value={editForm.transcriptSnippet}
                  onChange={(event) => setEditForm((current) => ({ ...current, transcriptSnippet: event.target.value }))}
                  rows={4}
                  className="input-field resize-y"
                />
              </div>
              <div>
                <label className="label-field">Reviewer Note</label>
                <textarea
                  value={editForm.feedback}
                  onChange={(event) => setEditForm((current) => ({ ...current, feedback: event.target.value }))}
                  rows={3}
                  className="input-field resize-y"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={handleDelete} disabled={reviewingId === editingFlag.id} className="min-h-[48px] rounded-2xl bg-semantic-error px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50">
                Delete
              </button>
              <button type="button" onClick={() => setEditingFlag(null)} className="btn-secondary px-4 text-sm font-bold">
                Cancel
              </button>
              <button type="submit" disabled={reviewingId === editingFlag.id} className="btn-primary px-6 text-sm">
                {reviewingId === editingFlag.id ? "Saving..." : "Save Flag"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

