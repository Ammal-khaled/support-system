import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getPolicyById } from "../services/firestore";

export default function PolicyDetailPage() {
  const { policyId } = useParams();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPolicy() {
      setLoading(true);
      const result = await getPolicyById(policyId);
      if (isMounted) {
        setPolicy(result);
        setLoading(false);
      }
    }

    loadPolicy();

    return () => {
      isMounted = false;
    };
  }, [policyId]);

  return (
    <div className="page-bg">
      <Sidebar />

      <main className="min-h-screen px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-5 rounded-2xl bg-white/70 px-4 py-2 text-sm font-extrabold text-brand-primary shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            Back to results
          </button>

          {loading ? (
            <section className="glass-card p-10 text-center text-sm font-semibold text-semantic-neutral">
              Loading workflow...
            </section>
          ) : !policy ? (
            <section className="glass-card p-10 text-center">
              <p className="text-lg font-extrabold text-slate-950">Workflow not found.</p>
              <p className="mt-2 text-sm text-semantic-neutral">
                It may have been removed from the knowledge base.
              </p>
              <Link
                to="/agent"
                className="mt-5 inline-flex rounded-2xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light"
              >
                Open Agent Desk
              </Link>
            </section>
          ) : (
            <article className="glass-card overflow-hidden">
              {policy.asset && (
                <div className="bg-gradient-to-r from-brand-primary to-cyan-500 p-5 text-white sm:p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/80">
                        Customer Reference
                      </p>
                      <h2 className="mt-2 text-2xl font-extrabold">SD Refund QR</h2>
                    </div>
                    <img
                      src={policy.asset}
                      alt={`${policy.title} QR code`}
                      className="h-28 w-28 rounded-3xl bg-white object-cover p-1 shadow-card"
                    />
                  </div>
                </div>
              )}

              <div className="p-5 sm:p-8">
                <div className="mb-7">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-brand-faint px-3 py-1 text-xs font-extrabold text-brand-primary">
                      {policy.category || "General"}
                    </span>
                    {policy.priority && (
                      <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold text-semantic-neutral">
                        {policy.priority} priority
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    {policy.title || "Untitled Workflow"}
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-semantic-neutral">
                    {policy.content || "No content available."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <section className="glass-panel p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-900">
                      Ask First
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {(policy.customerQuestions || []).map((question) => (
                        <li key={question} className="flex gap-3 text-sm leading-6 text-slate-700">
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-primary" />
                          {question}
                        </li>
                      ))}
                      {!policy.customerQuestions?.length && (
                        <li className="text-sm text-semantic-neutral">
                          No customer questions added yet.
                        </li>
                      )}
                    </ul>
                  </section>

                  <section className="glass-panel p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-900">
                      Do Next
                    </h3>
                    <ol className="mt-4 space-y-3">
                      {(policy.agentSteps || []).map((step, index) => (
                        <li key={step} className="flex gap-3 text-sm leading-6 text-slate-700">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                      {!policy.agentSteps?.length && (
                        <li className="text-sm text-semantic-neutral">
                          No agent steps added yet.
                        </li>
                      )}
                    </ol>
                  </section>
                </div>

                {policy.sourceFiles?.length > 0 && (
                  <section className="mt-5 glass-panel p-5">
                    <button
                      type="button"
                      onClick={() => setShowSources((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
                        Source Documents
                      </span>
                      <span className="text-sm font-bold text-brand-primary">
                        {showSources ? "Hide" : "Show"}
                      </span>
                    </button>
                    {showSources && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {policy.sourceFiles.map((source) => (
                          <span
                            key={source}
                            className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
