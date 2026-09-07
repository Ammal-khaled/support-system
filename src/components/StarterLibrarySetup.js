import { useCallback, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query as firestoreQuery,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import starterWorkflows from "../data/aquacoolKnowledge.json";

function workflowKey(workflow) {
  return `${workflow.title || ""}::${workflow.category || ""}`.toLowerCase();
}

export default function StarterLibrarySetup({ articles = [], onComplete }) {
  const [category, setCategory] = useState("All");
  const [publishingId, setPublishingId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(starterWorkflows.map((item) => item.category))).sort()],
    []
  );

  const publishedSourceIds = useMemo(
    () => new Set(articles.map((article) => article.sourceId).filter(Boolean)),
    [articles]
  );

  const publishedWorkflowKeys = useMemo(
    () => new Set(articles.map((article) => workflowKey(article))),
    [articles]
  );

  const isWorkflowPublished = useCallback(
    (workflow) =>
      publishedSourceIds.has(workflow.id) || publishedWorkflowKeys.has(workflowKey(workflow)),
    [publishedSourceIds, publishedWorkflowKeys]
  );

  const remainingCount = starterWorkflows.filter((workflow) => !isWorkflowPublished(workflow)).length;

  const visibleWorkflows = useMemo(() => {
    const workflows = category === "All"
      ? starterWorkflows
      : starterWorkflows.filter((workflow) => workflow.category === category);

    return workflows.filter((workflow) => !isWorkflowPublished(workflow));
  }, [category, isWorkflowPublished]);

  const publishWorkflow = async (workflow, quiet = false) => {
    const existingBySource = await getDocs(
      firestoreQuery(collection(db, "knowledge_base"), where("sourceId", "==", workflow.id))
    );

    if (!existingBySource.empty || isWorkflowPublished(workflow)) {
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

  const finishIfComplete = (createdCount) => {
    if (createdCount || remainingCount <= 1) {
      onComplete?.();
    }
  };

  const handlePublishWorkflow = async (workflow) => {
    setPublishingId(workflow.id);
    setStatus("");
    setError("");

    try {
      const created = await publishWorkflow(workflow);
      if (created) setStatus(`${workflow.title} published to the knowledge base.`);
      finishIfComplete(created ? 1 : 0);
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
          ? `${createdCount} Aquacool workflows published. Setup tools are now hidden.`
          : "All Aquacool workflows are already published. Setup tools are now hidden."
      );
      onComplete?.();
    } catch (err) {
      console.error("Error publishing Aquacool workflows:", err);
      setError("Unable to publish the Aquacool starter library.");
    } finally {
      setPublishingId("");
    }
  };

  if (remainingCount === 0) {
    return null;
  }

  return (
    <section className="glass-card p-5">
      <div className="flex flex-col gap-4 border-b border-surface-border pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="label-field mb-2">Setup Tools</p>
          <h2 className="text-xl font-extrabold text-slate-950">
            Aquacool Starter Library
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-semantic-neutral">
            Publish the prepared Aquacool workflow cards once during setup. After the library is live, this setup panel hides from the daily dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePublishAll}
          disabled={publishingId === "all"}
          className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishingId === "all" ? "Publishing..." : `Publish ${remainingCount} Remaining`}
        </button>
      </div>

      {(status || error) && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            error
              ? "border-red-100 bg-red-50 text-semantic-error"
              : "border-green-100 bg-green-50 text-semantic-success"
          }`}
        >
          {error || status}
        </div>
      )}

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
        {visibleWorkflows.length === 0 ? (
          <div className="rounded-card border border-surface-border bg-surface-card p-5 text-sm font-semibold text-semantic-neutral lg:col-span-2">
            This category is already published.
          </div>
        ) : (
          visibleWorkflows.map((workflow) => (
            <article
              key={workflow.id}
              className="rounded-card border border-surface-border bg-surface-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-faint px-2.5 py-1 text-xs font-extrabold text-brand-primary">
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
                  disabled={Boolean(publishingId)}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-primary transition-colors hover:bg-brand-faint disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {publishingId === workflow.id ? "Publishing..." : "Publish"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
