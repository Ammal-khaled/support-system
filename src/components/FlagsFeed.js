import { useEffect, useState } from "react";
import { markFlagReviewed, subscribeFlags } from "../services/firestore";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return "Pending";
  return timestamp.toDate().toLocaleString();
}

export default function FlagsFeed() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState(null);

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

  const handleMarkReviewed = async (flagId) => {
    setReviewingId(flagId);
    try {
      await markFlagReviewed(flagId);
    } finally {
      setReviewingId(null);
    }
  };

  const openCount = flags.filter((flag) => !flag.reviewed).length;

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="card-header">Live Flag Feed</h2>
          <p className="card-subtext">Real-time critical and soft-skill observations.</p>
        </div>
        <span className="font-mono text-sm font-semibold text-accent-cyan bg-mission-bg border border-mission-border px-3 py-1.5 rounded-full">
          {openCount} open
        </span>
      </div>

      {loading ? (
        <p className="text-text-muted">Loading flags...</p>
      ) : error ? (
        <p className="text-accent-coral text-sm font-semibold">{error}</p>
      ) : flags.length === 0 ? (
        <p className="text-text-muted">No flags logged yet.</p>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const isCritical = flag.type === "critical";

            return (
              <article key={flag.id} className="border border-mission-border rounded-enterprise p-4 bg-mission-bg">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          isCritical
                            ? "bg-accent-coral/15 text-accent-coral border border-accent-coral/30"
                            : "bg-accent-amber/15 text-accent-amber border border-accent-amber/30"
                        }`}
                      >
                        {isCritical ? "Critical" : "Soft Skill"}
                      </span>
                      {flag.reviewed && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30">
                          Reviewed
                        </span>
                      )}
                      <span className="text-sm font-semibold text-text-main">
                        {flag.agentName || "Unknown Agent"}
                      </span>
                    </div>
                    <p className="font-semibold text-text-main">
                      Matched: &ldquo;{flag.matchedPhrase || "Unknown phrase"}&rdquo;
                    </p>
                    {flag.transcriptSnippet && (
                      <p className="text-sm text-text-muted mt-2 italic border-l-2 border-mission-border pl-3">
                        &ldquo;{flag.transcriptSnippet}&rdquo;
                      </p>
                    )}
                    <p className="font-mono text-sm text-text-muted mt-2">{formatTimestamp(flag.timestamp)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={flag.reviewed || reviewingId === flag.id}
                    onClick={() => handleMarkReviewed(flag.id)}
                    className="shrink-0 px-3 py-2 rounded-enterprise bg-accent-violet text-white text-sm font-semibold hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {flag.reviewed ? "Reviewed" : reviewingId === flag.id ? "Saving..." : "Mark Reviewed"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
