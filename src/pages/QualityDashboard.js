import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import AgentActionsFeed from "../components/AgentActionsFeed";
import AfterCallReportsFeed from "../components/AfterCallReportsFeed";
import BannedPhrasesManager from "../components/BannedPhrasesManager";
import FlagsFeed from "../components/FlagsFeed";
import SoftSkillsEvaluator from "../components/SoftSkillsEvaluator";
import { subscribeAgentActions, subscribeFlags } from "../services/firestore";

function QualityMetric({ label, value, tone = "text-current", destination, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card border border-surface-border bg-surface-card p-5 text-left transition-colors hover:border-brand-primary hover:bg-surface-panel focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
    >
      <p className="label-field mb-6">{label}</p>
      <p className={`metric-value ${tone}`}>{value}</p>
      <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
        Open {destination}
      </p>
    </button>
  );
}

export default function QualityDashboard() {
  const [searchParams] = useSearchParams();
  const [flags, setFlags] = useState([]);
  const [actions, setActions] = useState([]);
  const [qualityQuery, setQualityQuery] = useState("");
  const [tab, setTab] = useState(() => {
    if (searchParams.get("tab") === "support") return "Support Requests";
    if (searchParams.get("tab") === "reports") return "After-Call Reports";
    return "Review Queue";
  });

  useEffect(() => {
    if (searchParams.get("tab") === "support") {
      setTab("Support Requests");
    }
    if (searchParams.get("tab") === "reports") {
      setTab("After-Call Reports");
    }
  }, [searchParams]);

  useEffect(() => {
    const unsubscribeFlags = subscribeFlags(setFlags);
    const unsubscribeActions = subscribeAgentActions(setActions);

    return () => {
      unsubscribeFlags();
      unsubscribeActions();
    };
  }, []);

  const stats = useMemo(() => {
    const openFlags = flags.filter((flag) => !flag.reviewed);

    return {
      openReviews: openFlags.length,
      critical: openFlags.filter((flag) => flag.type === "critical").length,
      softSkill: openFlags.filter((flag) => flag.type === "soft_skill").length,
      recentActions: actions.length,
    };
  }, [actions.length, flags]);

  return (
    <div className="page-bg">
      <Sidebar />

      <main className="min-h-screen px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 border-b border-surface-border pb-8">
            <p className="label-field">Quality Workspace</p>
            <h1 className="page-title">Quality Review Dashboard</h1>
            <p className="page-subtitle">
              Review call mistakes, maintain quality rules, and manage the knowledge context used by after-call AI reports.
            </p>
          </header>

          <section className="metric-grid mb-8 grid gap-3">
            <QualityMetric label="Open Reviews" value={stats.openReviews} tone="text-brand-primary" destination="Review Queue" onClick={() => setTab("Review Queue")} />
            <QualityMetric label="Critical" value={stats.critical} tone="text-semantic-error" destination="Critical Flags" onClick={() => setTab("Critical Flags")} />
            <QualityMetric label="Soft Skill" value={stats.softSkill} tone="text-semantic-warning" destination="Soft Skills" onClick={() => setTab("Soft Skills")} />
            <QualityMetric label="Support Requests" value={stats.recentActions} tone="text-semantic-success" destination="Support Requests" onClick={() => setTab("Support Requests")} />
            <QualityMetric label="After-Call Reports" value="AI" tone="text-brand-primary" destination="Reports" onClick={() => setTab("After-Call Reports")} />
          </section>

          <section className="mb-6">
            <div className="admin-tab-shell">
              {[
                "Review Queue",
                "Soft Skills",
                "Critical Flags",
                "After-Call Reports",
                "Flag Rules",
                "AI Rule Sandbox",
                "Support Requests",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`admin-tab ${tab === item ? "admin-tab-active" : "admin-tab-inactive"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {["Review Queue", "Soft Skills", "Critical Flags", "After-Call Reports", "Support Requests"].includes(tab) && (
            <section className="mb-6 glass-card p-4 sm:p-5">
              <label>
                <span className="label-field">Search This View</span>
                <input
                  type="search"
                  value={qualityQuery}
                  onChange={(event) => setQualityQuery(event.target.value)}
                  className="input-field mt-2"
                  placeholder="Search by agent, flag, report, transcript, request, status, or ID..."
                />
              </label>
            </section>
          )}

          {tab === "Review Queue" && <FlagsFeed externalSearchQuery={qualityQuery} showSearch={false} />}

          {tab === "Soft Skills" && <FlagsFeed typeFilter="soft_skill" externalSearchQuery={qualityQuery} showSearch={false} />}

          {tab === "Critical Flags" && <FlagsFeed typeFilter="critical" externalSearchQuery={qualityQuery} showSearch={false} />}

          {tab === "Support Requests" && <AgentActionsFeed externalSearchQuery={qualityQuery} showSearch={false} />}

          {tab === "After-Call Reports" && <AfterCallReportsFeed externalSearchQuery={qualityQuery} showSearch={false} />}

          {tab === "Flag Rules" && <BannedPhrasesManager />}

          {tab === "AI Rule Sandbox" && <SoftSkillsEvaluator />}
        </div>
      </main>
    </div>
  );
}
