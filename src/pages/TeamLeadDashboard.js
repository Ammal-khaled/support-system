import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query as firestoreQuery,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import ActionTypesManager from "../components/ActionTypesManager";
import BannedPhrasesManager from "../components/BannedPhrasesManager";
import KnowledgeBaseForm from "../components/KnowledgeBaseForm";
import AgentActionsFeed from "../components/AgentActionsFeed";
import FlagsFeed from "../components/FlagsFeed";
import SoftSkillsEvaluator from "../components/SoftSkillsEvaluator";
import starterWorkflows from "../data/aquacoolKnowledge.json";
import {
  subscribeAgentActions,
  subscribeFlags,
} from "../services/firestore";

const MANAGEMENT_TABS = ["Overview", "AI Coaching", "Knowledge", "Actions", "Quality Rules", "Live Feeds"];

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
  const [publishingId, setPublishingId] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("");
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

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(starterWorkflows.map((item) => item.category))).sort()],
    []
  );

  const visibleWorkflows = useMemo(() => {
    if (category === "All") return starterWorkflows;
    return starterWorkflows.filter((workflow) => workflow.category === category);
  }, [category]);

  const publishedSourceIds = useMemo(
    () => new Set(articles.map((article) => article.sourceId).filter(Boolean)),
    [articles]
  );

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

  const publishWorkflow = async (workflow, quiet = false) => {
    const existing = await getDocs(
      firestoreQuery(collection(db, "knowledge_base"), where("sourceId", "==", workflow.id))
    );

    if (!existing.empty) {
      if (!quiet) setStatus(`${workflow.title} is already published.`);
      return false;
    }

    await addDoc(collection(db, "knowledge_base"), {
      title: workflow.title,
      content: workflow.summary,
      category: workflow.category,
      priority: workflow.priority,
      sourceId: workflow.id,
      customerQuestions: workflow.customerQuestions,
      agentSteps: workflow.agentSteps,
      sourceFiles: workflow.sourceFiles,
      keywords: workflow.keywords,
      asset: workflow.asset || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  };

  const handlePublishWorkflow = async (workflow) => {
    setPublishingId(workflow.id);
    setStatus("");
    setError("");

    try {
      const created = await publishWorkflow(workflow);
      if (created) setStatus(`${workflow.title} published to the knowledge base.`);
      window.setTimeout(() => setStatus(""), 2400);
    } catch (err) {
      console.error("Error publishing Aquacool workflow:", err);
      setError("Unable to publish workflow. Please check your access and try again.");
    } finally {
      setPublishingId("");
    }
  };

  const handlePublishAll = async () => {
    setPublishingId("all");
    setStatus("");
    setError("");

    try {
      let createdCount = 0;
      for (const workflow of starterWorkflows) {
        const created = await publishWorkflow(workflow, true);
        if (created) createdCount += 1;
      }

      setStatus(
        createdCount
          ? `${createdCount} Aquacool workflows published.`
          : "All Aquacool workflows are already published."
      );
      window.setTimeout(() => setStatus(""), 2600);
    } catch (err) {
      console.error("Error publishing Aquacool workflows:", err);
      setError("Unable to publish the Aquacool starter library.");
    } finally {
      setPublishingId("");
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

          {(status || error) && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                error
                  ? "border-red-100 bg-red-50 text-semantic-error"
                  : "border-green-100 bg-green-50 text-semantic-success"
              }`}
            >
              {error || status}
            </div>
          )}

          <section className="mb-6 glass-card p-4 sm:p-5">
            <div className="flex gap-2 overflow-x-auto">
              {MANAGEMENT_TABS.map((item) => (
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

          {managementTab === "Knowledge" && (
            <>
          <div className="mb-6 glass-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">
                  Aquacool Starter Library
                </h2>
                <p className="mt-1 text-sm text-semantic-neutral">
                  Preloaded workflow templates from the supplied Aquacool documents. Publish one or all to add them to the live knowledge base used by agents.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePublishAll}
                disabled={publishingId === "all"}
                className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishingId === "all" ? "Publishing..." : "Publish Full Library"}
              </button>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    category === item
                      ? "bg-brand-faint text-brand-primary"
                      : "bg-surface-bg text-semantic-neutral hover:bg-slate-100"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visibleWorkflows.map((workflow) => {
                const isPublished = publishedSourceIds.has(workflow.id);

                return (
                  <article
                    key={workflow.id}
                    className="rounded-2xl border border-surface-border bg-surface-card p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-brand-primary">
                            {workflow.category}
                          </span>
                          <span className="text-xs font-bold text-semantic-neutral">
                            {workflow.priority} priority
                          </span>
                        </div>
                        <h3 className="font-extrabold text-slate-950">{workflow.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-semantic-neutral">
                          {workflow.summary}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePublishWorkflow(workflow)}
                        disabled={isPublished || Boolean(publishingId)}
                        className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                          isPublished
                            ? "bg-green-50 text-semantic-success"
                            : "bg-white text-brand-primary hover:bg-brand-faint"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        {isPublished
                          ? "Live"
                          : publishingId === workflow.id
                            ? "Publishing..."
                            : "Publish"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <KnowledgeBaseForm />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
