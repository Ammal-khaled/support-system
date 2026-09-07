import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import ActionTypesManager from "../components/ActionTypesManager";
import BannedPhrasesManager from "../components/BannedPhrasesManager";
import KnowledgeBaseForm from "../components/KnowledgeBaseForm";
import AgentActionsFeed from "../components/AgentActionsFeed";
import FlagsFeed from "../components/FlagsFeed";
import SoftSkillsEvaluator from "../components/SoftSkillsEvaluator";
import StarterLibrarySetup from "../components/StarterLibrarySetup";
import {
  subscribeAgentActions,
  subscribeFlags,
} from "../services/firestore";

const STARTER_LIBRARY_STORAGE_KEY = "aquadesk_starter_library_hidden";
const BASE_MANAGEMENT_TABS = ["Overview", "AI Coaching", "Knowledge", "Actions", "Quality Rules", "Live Feeds"];

function Metric({ label, value, tone = "text-current" }) {
  return (
    <div className="rounded-card border border-surface-border bg-surface-card p-5">
      <p className="label-field mb-6">{label}</p>
      <p className={`metric-value ${tone}`}>{value}</p>
    </div>
  );
}

export default function TeamLeadDashboard() {
  const [managementTab, setManagementTab] = useState("Knowledge");
  const [articles, setArticles] = useState([]);
  const [flags, setFlags] = useState([]);
  const [actions, setActions] = useState([]);
  const [showSetupTools, setShowSetupTools] = useState(
    () => window.localStorage.getItem(STARTER_LIBRARY_STORAGE_KEY) !== "true"
  );
  const [error, setError] = useState("");

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

  useEffect(() => {
    const unsubscribeFlags = subscribeFlags(setFlags);
    const unsubscribeActions = subscribeAgentActions(setActions);

    return () => {
      unsubscribeFlags();
      unsubscribeActions();
    };
  }, []);

  const missionStats = useMemo(() => {
    const activeFlags = flags.filter((flag) => !flag.reviewed);
    const activeAgents = new Set(actions.map((action) => action.agentName).filter(Boolean));

    return {
      activeFlags: activeFlags.length,
      criticalFlags: activeFlags.filter((flag) => flag.type === "critical").length,
      softSkillFlags: activeFlags.filter((flag) => flag.type === "soft_skill").length,
      activeAgents: activeAgents.size,
      kbArticles: articles.length,
    };
  }, [actions, articles, flags]);

  const managementTabs = useMemo(
    () => showSetupTools ? [...BASE_MANAGEMENT_TABS, "Setup Tools"] : BASE_MANAGEMENT_TABS,
    [showSetupTools]
  );

  const handleSetupComplete = () => {
    window.localStorage.setItem(STARTER_LIBRARY_STORAGE_KEY, "true");
    setShowSetupTools(false);
    if (managementTab === "Setup Tools") {
      setManagementTab("Knowledge");
    }
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
                Team Lead Dashboard
              </h1>
              <p className="page-subtitle">
                Monitor live coaching signals, maintain support content, and test Tier 2 post-call AI evaluation.
              </p>
            </div>

            <div className="hidden lg:block text-right">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">
                Tier 1: keyword matching
              </p>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-primary mt-2">
                Tier 2: AI coaching
              </p>
            </div>
            </div>
          </header>

          <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Active Flags" value={missionStats.activeFlags} tone="text-brand-primary" />
            <Metric label="Critical" value={missionStats.criticalFlags} tone="text-semantic-error" />
            <Metric label="Soft Skill" value={missionStats.softSkillFlags} tone="text-semantic-warning" />
            <Metric label="Agents Active" value={missionStats.activeAgents} tone="text-semantic-success" />
            <Metric label="KB Articles" value={missionStats.kbArticles} />
          </section>

          {error && (
            <div
              className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-semantic-error"
            >
              {error}
            </div>
          )}

          <section className="mb-6 glass-card p-4 sm:p-5">
            <div className="flex gap-2 overflow-x-auto">
              {managementTabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setManagementTab(item)}
                  className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-extrabold transition-colors ${
                    managementTab === item
                      ? "bg-brand-primary text-white shadow-card"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {managementTab === "Overview" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <FlagsFeed />
              <AgentActionsFeed />
            </div>
          )}

          {managementTab === "AI Coaching" && <SoftSkillsEvaluator />}

          {managementTab === "Actions" && <ActionTypesManager />}

          {managementTab === "Quality Rules" && <BannedPhrasesManager />}

          {managementTab === "Live Feeds" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <FlagsFeed />
              <AgentActionsFeed />
            </div>
          )}

          {managementTab === "Knowledge" && <KnowledgeBaseForm />}

          {managementTab === "Setup Tools" && showSetupTools && (
            <StarterLibrarySetup articles={articles} onComplete={handleSetupComplete} />
          )}
        </div>
      </main>
    </div>
  );
}
