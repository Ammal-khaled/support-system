import { useEffect, useState } from "react";
import { subscribeAfterCallReports, subscribeUsers } from "../services/firestore";

function formatTimestamp(timestamp) {
  if (timestamp === null) return "Sample report";
  if (!timestamp?.toDate) return "Pending timestamp";
  return timestamp.toDate().toLocaleString();
}

function statusLabel(report) {
  if (report.overallStatus === "critical_review") return "Critical review";
  if (report.overallStatus === "coaching_needed") return "Coaching needed";
  return "Clear";
}

const SAMPLE_REPORT = {
  id: "sample-after-call-report",
  agentName: "Demo Agent",
  createdAt: null,
  status: "sample",
  overallStatus: "coaching_needed",
  severity: "soft_skill",
  summary:
    "Sample only: the agent gave the correct refund boundary, but the response sounded too final and did not clearly explain the next step.",
  softSkills: {
    status: "Coaching needed",
    feedback:
      "The agent should combine policy limits with ownership language, for example: I cannot promise approval, but I will make sure the request is reviewed and explain what happens next.",
  },
  bannedPhrases: [
    {
      phrase: "I cannot help",
      severity: "soft_skill",
      replacement: "I can help explain the next available step.",
    },
  ],
  incorrectInformation: [
    {
      claim: "Refund approval is guaranteed",
      correction: "Refunds must be reviewed against the approved policy before an outcome is promised.",
    },
  ],
  recommendations: [
    "Coach the agent to acknowledge the customer concern before explaining policy.",
    "Confirm the next follow-up step before ending the call.",
    "Review refund wording in the knowledge base before the next shift.",
  ],
};

export default function AfterCallReportsFeed({ externalSearchQuery = "", showSearch = true }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openReportId, setOpenReportId] = useState("");
  const [inactiveUserIds, setInactiveUserIds] = useState(new Set());

  useEffect(() => {
    const unsubscribe = subscribeAfterCallReports(
      (data) => {
        setReports(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load after-call reports.");
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

  const visibleReports = reports.filter((report) => {
    const search = (showSearch ? query : externalSearchQuery).trim().toLowerCase();
    const activeProfile = !report.agentId || !inactiveUserIds.has(report.agentId);
    const matchesSearch = !search || [
      report.id,
      report.agentId,
      report.agentName,
      report.status,
      report.overallStatus,
      report.severity,
      report.summary,
      report.transcript,
      report.softSkills?.status,
      report.softSkills?.feedback,
      ...(report.bannedPhrases || []).flatMap((item) => [item.phrase, item.severity, item.replacement]),
      ...(report.incorrectInformation || []).flatMap((item) => [item.claim, item.correction]),
      ...(report.recommendations || []),
    ].some((field) => String(field || "").toLowerCase().includes(search));

    return activeProfile && matchesSearch;
  });
  const activeSearch = (showSearch ? query : externalSearchQuery).trim();
  const showSample = !activeSearch && visibleReports.length === 0;
  const displayReports = visibleReports.length > 0 ? visibleReports : showSample ? [SAMPLE_REPORT] : [];

  return (
    <section className="card p-6">
      <div className="mb-5">
        <p className="label-field">Tier 2 AI Review</p>
        <h2 className="card-header">After-Call Reports</h2>
        <p className="card-subtext">
          One complete report per finished call, including soft skills, policy language, and knowledge-base accuracy.
        </p>
      </div>

      {showSearch && (
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field"
          placeholder="Search reports by agent, transcript, issue, recommendation, or ID..."
        />
      </div>
      )}

      {loading ? (
        <p className="text-semantic-neutral">Loading reports...</p>
      ) : error ? (
        <p className="text-semantic-error text-sm font-semibold">{error}</p>
      ) : (
        <div className="space-y-4">
          {showSample && (
            <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm font-semibold text-brand-primary">
              Sample preview only. Real after-call reports will appear here after the extension sends a finished call transcript to AI.
            </div>
          )}
          {!showSample && displayReports.length === 0 && (
            <p className="text-semantic-neutral">No after-call reports match this search.</p>
          )}
          {displayReports.map((report) => {
            const phraseCount = report.bannedPhrases?.length || 0;
            const informationCount = report.incorrectInformation?.length || 0;
            const isOpen = openReportId === report.id || (showSample && openReportId !== "");
            return (
              <article key={report.id} className="border border-surface-border rounded-xl bg-surface-bg">
                <button
                  type="button"
                  onClick={() => setOpenReportId((current) => current === report.id ? "" : report.id)}
                  className="w-full p-5 text-left"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        report.severity === "critical"
                          ? "bg-semantic-error/15 text-semantic-error border border-semantic-error/30"
                          : report.severity === "soft_skill"
                            ? "bg-semantic-warning/15 text-semantic-warning border border-semantic-warning/30"
                            : "bg-semantic-success/15 text-semantic-success border border-semantic-success/30"
                      }`}>
                        {statusLabel(report)}
                      </span>
                      <span className="font-semibold text-slate-900">{report.agentName || "Unknown Agent"}</span>
                    </div>
                    <p className="text-sm text-semantic-neutral mt-2">{formatTimestamp(report.createdAt)}</p>
                    <p className="mt-3 line-clamp-2 font-semibold text-slate-900">{report.summary || "No summary provided."}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
                        {report.status || "open"}
                      </span>
                      <span className="rounded-xl bg-brand-faint px-3 py-2 text-sm font-extrabold text-brand-primary">
                        {isOpen ? "Hide details" : "Open report"}
                      </span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-surface-border px-5 pb-5">
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="border border-surface-border rounded-lg p-3">
                    <p className="label-field">Soft skills</p>
                    <p className="mt-1 text-sm text-semantic-neutral">{report.softSkills?.status || "Not scored"}</p>
                  </div>
                  <div className="border border-surface-border rounded-lg p-3">
                    <p className="label-field">Policy phrases</p>
                    <p className="mt-1 text-sm text-semantic-neutral">{phraseCount} found</p>
                  </div>
                  <div className="border border-surface-border rounded-lg p-3">
                    <p className="label-field">Incorrect information</p>
                    <p className="mt-1 text-sm text-semantic-neutral">{informationCount} found</p>
                  </div>
                </div>

                {report.softSkills?.feedback && (
                  <p className="mt-4 text-sm text-semantic-neutral border-l-2 border-brand-primary pl-3">
                    {report.softSkills.feedback}
                  </p>
                )}
                {report.recommendations?.length > 0 && (
                  <div className="mt-4">
                    <p className="label-field">Recommended next steps</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-semantic-neutral">
                      {report.recommendations.slice(0, 4).map((recommendation, index) => (
                        <li key={`${report.id}-recommendation-${index}`}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
                )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
