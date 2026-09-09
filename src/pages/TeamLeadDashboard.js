import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import ActionTypesManager from "../components/ActionTypesManager";
import AgentActionsFeed from "../components/AgentActionsFeed";
import FlagsFeed from "../components/FlagsFeed";
import KnowledgeBaseForm from "../components/KnowledgeBaseForm";
import StarterLibrarySetup from "../components/StarterLibrarySetup";
import AfterCallReportsFeed from "../components/AfterCallReportsFeed";
import {
  subscribeAgentActions,
  subscribeFlags,
} from "../services/firestore";

const STARTER_LIBRARY_STORAGE_KEY = "aquadesk_starter_library_hidden";

const BASE_MANAGEMENT_TABS = [
  "Summary",
  "After-Call Reports",
  "Support Requests",
  "Support Topics",
  "Knowledge",
];

function Metric({
  label,
  value,
  tone = "text-current",
  destination,
  onClick,
}) {
  const clickable = typeof onClick === "function";

  const content = (
    <>
      <div>
        <p className="label-field mb-6">{label}</p>
        <p className={`metric-value ${tone}`}>{value}</p>
      </div>

      {destination && (
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
          Open {destination}
        </p>
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group rounded-card border border-surface-border bg-surface-card p-5 text-left transition-colors hover:border-brand-primary hover:bg-surface-panel focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-card border border-surface-border bg-surface-card p-5">
      {content}
    </div>
  );
}

export default function TeamLeadDashboard() {
  const [managementTab, setManagementTab] = useState("Summary");
  const [flagFilter, setFlagFilter] = useState("all");
  const [managementQuery, setManagementQuery] = useState("");

  const [articles, setArticles] = useState([]);
  const [flags, setFlags] = useState([]);
  const [actions, setActions] = useState([]);

  const [showSetupTools, setShowSetupTools] = useState(
    () =>
      window.localStorage.getItem(STARTER_LIBRARY_STORAGE_KEY) !== "true"
  );

  const [error, setError] = useState("");

  // Knowledge Base listener
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "knowledge_base"),
      (snapshot) => {
        const kbData = snapshot.docs.map((articleDoc) => ({
          id: articleDoc.id,
          ...articleDoc.data(),
        }));

        setArticles(kbData);
        setError("");
      },
      () => {
        setError("Unable to load knowledge base policies.");
      }
    );

    return () => unsubscribe();
  }, []);

  // Flags and Support Requests listeners
  useEffect(() => {
    const unsubscribeFlags = subscribeFlags(setFlags);
    const unsubscribeActions = subscribeAgentActions(setActions);

    return () => {
      unsubscribeFlags();
      unsubscribeActions();
    };
  }, []);

  // Dashboard metrics
  const missionStats = useMemo(() => {
    const activeFlags = flags.filter((flag) => !flag.reviewed);

    // Only count requests that are NOT resolved
    const openSupportRequests = actions.filter((action) => {
      const status = String(action.status || "open")
        .trim()
        .toLowerCase();

      return status !== "resolved";
    });

    return {
      activeFlags: activeFlags.length,

      criticalFlags: activeFlags.filter(
        (flag) => flag.type === "critical"
      ).length,

      softSkillFlags: activeFlags.filter(
        (flag) => flag.type === "soft_skill"
      ).length,

      supportRequests: openSupportRequests.length,

      kbArticles: articles.length,
    };
  }, [actions, articles, flags]);

  const managementTabs = useMemo(
    () =>
      showSetupTools
        ? [...BASE_MANAGEMENT_TABS, "Setup Tools"]
        : BASE_MANAGEMENT_TABS,
    [showSetupTools]
  );

  const handleSetupComplete = () => {
    window.localStorage.setItem(
      STARTER_LIBRARY_STORAGE_KEY,
      "true"
    );

    setShowSetupTools(false);

    if (managementTab === "Setup Tools") {
      setManagementTab("Summary");
    }
  };

  const openManagementTab = (
    tab,
    nextFlagFilter = "all"
  ) => {
    setManagementTab(tab);
    setFlagFilter(nextFlagFilter);
  };

  return (
    <div className="page-bg font-sans">
      <Sidebar />

      <main className="min-h-screen px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 border-b border-surface-border pb-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="label-field">
                  Mission Control
                </p>

                <h1 className="page-title">
                  Team Lead Configuration
                </h1>

                <p className="page-subtitle">
                  Monitor support requests, open quality signals,
                  and after-call AI reports for coaching follow-up.
                </p>
              </div>

              <div className="hidden text-right lg:block">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                  Tier 1: keyword matching
                </p>

                <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-brand-primary">
                  Tier 2: AI coaching
                </p>
              </div>
            </div>
          </header>

          {/* Dashboard Metrics */}
          <section className="metric-grid mb-8 grid gap-3">
            <Metric
              label="Active Flags"
              value={missionStats.activeFlags}
              tone="text-brand-primary"
              destination="Summary"
              onClick={() =>
                openManagementTab("Summary")
              }
            />

            <Metric
              label="Critical"
              value={missionStats.criticalFlags}
              tone="text-semantic-error"
              destination="Summary"
              onClick={() =>
                openManagementTab(
                  "Summary",
                  "critical"
                )
              }
            />

            <Metric
              label="Soft Skill"
              value={missionStats.softSkillFlags}
              tone="text-semantic-warning"
              destination="Summary"
              onClick={() =>
                openManagementTab(
                  "Summary",
                  "soft_skill"
                )
              }
            />

            <Metric
              label="Support Requests"
              value={missionStats.supportRequests}
              tone="text-semantic-success"
              destination="Support Requests"
              onClick={() =>
                openManagementTab(
                  "Support Requests"
                )
              }
            />

            <Metric
              label="KB Articles"
              value={missionStats.kbArticles}
              destination="Knowledge"
              onClick={() =>
                openManagementTab("Knowledge")
              }
            />
          </section>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-semantic-error">
              {error}
            </div>
          )}

          {/* Navigation Tabs */}
          <section className="mb-6">
            <div className="admin-tab-shell">
              {managementTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    openManagementTab(item)
                  }
                  className={`admin-tab ${
                    managementTab === item
                      ? "admin-tab-active"
                      : "admin-tab-inactive"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {/* Search */}
          {[
            "Summary",
            "After-Call Reports",
            "Support Requests",
          ].includes(managementTab) && (
            <section className="mb-6 glass-card p-4 sm:p-5">
              <label>
                <span className="label-field">
                  Search This View
                </span>

                <input
                  type="search"
                  value={managementQuery}
                  onChange={(event) =>
                    setManagementQuery(
                      event.target.value
                    )
                  }
                  className="input-field mt-2"
                  placeholder="Search by agent, request, flag, report, status, note, or ID..."
                />
              </label>
            </section>
          )}

          {/* Summary */}
          {managementTab === "Summary" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <FlagsFeed
                typeFilter={flagFilter}
                externalSearchQuery={
                  managementQuery
                }
                showSearch={false}
              />

              <AgentActionsFeed
                externalSearchQuery={
                  managementQuery
                }
                showSearch={false}
              />
            </div>
          )}

          {/* After Call Reports */}
          {managementTab ===
            "After-Call Reports" && (
            <AfterCallReportsFeed
              externalSearchQuery={
                managementQuery
              }
              showSearch={false}
            />
          )}

          {/* Support Requests */}
          {managementTab ===
            "Support Requests" && (
            <AgentActionsFeed
              externalSearchQuery={
                managementQuery
              }
              showSearch={false}
            />
          )}

          {/* Support Topics */}
          {managementTab ===
            "Support Topics" && (
            <ActionTypesManager />
          )}

          {/* Knowledge */}
          {managementTab === "Knowledge" && (
            <KnowledgeBaseForm />
          )}

          {/* Setup Tools */}
          {managementTab === "Setup Tools" &&
            showSetupTools && (
              <StarterLibrarySetup
                articles={articles}
                onComplete={
                  handleSetupComplete
                }
              />
            )}
        </div>
      </main>
    </div>
  );
}
