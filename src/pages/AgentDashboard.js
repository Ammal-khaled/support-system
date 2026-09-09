import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribePolicies } from "../services/firestore";
import { useAuth } from "../context/AuthContext";
import ActionSelector from "../components/ActionSelector";
import Sidebar from "../components/Sidebar";

const ALL_CATEGORIES = "All";

const DEPARTMENT_LABELS = {
  [ALL_CATEGORIES]: "All Departments",
  "Account Updates": "Accounts",
  Billing: "Billing",
  Clearance: "Clearance",
  Contacts: "Contacts",
  "Move In": "Move In",
  "Move Out": "Move Out",
  Payments: "Payments",
  Refunds: "Refunds",
  Registration: "Registration",
  Resale: "Resale",
  "Service Status": "Service",
  Waivers: "Waivers",
};

export default function AgentDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { userProfile } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribePolicies(
      (data) => {
        setPolicies(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load the knowledge base.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const categories = useMemo(() => {
    const categoryList = policies.map((policy) => policy.category).filter(Boolean);
    return [ALL_CATEGORIES, ...Array.from(new Set(categoryList)).sort()];
  }, [policies]);

  const categoryCounts = useMemo(() => {
    return policies.reduce(
      (counts, policy) => {
        counts[ALL_CATEGORIES] += 1;
        if (policy.category) {
          counts[policy.category] = (counts[policy.category] || 0) + 1;
        }
        return counts;
      },
      { [ALL_CATEGORIES]: 0 }
    );
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return policies
      .map((policy) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORIES || policy.category === activeCategory;

        if (!matchesCategory) return null;
        if (!q) return { policy, score: 0 };

        const keywordText = (policy.keywords || []).join(" ").toLowerCase();
        const titleText = String(policy.title || "").toLowerCase();
        const contentText = String(policy.content || "").toLowerCase();
        const categoryText = String(policy.category || "").toLowerCase();
        const priorityText = String(policy.priority || "").toLowerCase();
        const score =
          (keywordText.includes(q) ? 3 : 0) +
          (titleText.includes(q) ? 2 : 0) +
          (contentText.includes(q) ? 1 : 0) +
          (categoryText.includes(q) || priorityText.includes(q) ? 1 : 0);

        return score > 0 ? { policy, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || String(a.policy.title || "").localeCompare(String(b.policy.title || "")))
      .map((item) => item.policy);
  }, [activeCategory, policies, searchQuery]);

  const greeting = userProfile?.name || "Agent";

  return (
    <div className="page-bg">
      <Sidebar />

      <main className="min-h-screen px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 glass-card p-5 sm:p-7">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              Agent Workspace
            </p>
            <div>
              <div>
                <h1 className="font-heading text-3xl font-extrabold tracking-tight text-current sm:text-4xl">
                  Answer Desk
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-semantic-neutral sm:text-base">
                  Welcome, {greeting}. Pick the customer intent, then follow one clear
                  answer path.
                </p>
              </div>
            </div>
          </header>

          <section className="sticky top-[118px] z-30 mb-5 py-2 lg:top-0">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition-colors ${
                    activeCategory === category
                      ? "bg-brand-primary text-white shadow-card"
                      : "border border-surface-border bg-surface-card text-semantic-neutral shadow-sm hover:border-brand-primary hover:text-brand-primary"
                  }`}
                >
                  <span>{DEPARTMENT_LABELS[category] || category}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeCategory === category
                        ? "bg-white/20 text-white"
                        : "bg-surface-panel text-semantic-neutral"
                    }`}
                  >
                    {categoryCounts[category] || 0}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-6 glass-card p-4 sm:p-5">
            <input
              type="search"
              placeholder={`Search ${DEPARTMENT_LABELS[activeCategory] || activeCategory}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field text-base"
            />
          </section>

          <ActionSelector />

          {loading ? (
            <section className="glass-card p-10 text-center text-sm font-semibold text-semantic-neutral">
              Loading live knowledge workflows...
            </section>
          ) : error ? (
            <section className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center text-sm font-semibold text-semantic-error">
              {error}
            </section>
          ) : filteredPolicies.length === 0 ? (
            <section className="glass-card p-10 text-center">
              <p className="font-extrabold text-current">No matching workflow found.</p>
              <p className="mt-2 text-sm text-semantic-neutral">
                Try a broader category or search a customer intent like refund, move out,
                or billing.
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPolicies.map((policy) => (
                <Link
                  key={policy.id}
                  to={`/agent/policies/${policy.id}`}
                  className="group flex min-h-[220px] flex-col justify-between rounded-card border border-surface-border bg-surface-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-xl"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-brand-faint px-3 py-1 text-xs font-extrabold text-brand-primary">
                        {policy.category || "General"}
                      </span>
                      {policy.priority && (
                        <span className="rounded-full bg-surface-panel px-2.5 py-1 text-xs font-bold text-semantic-neutral">
                          {policy.priority}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-extrabold tracking-tight text-current group-hover:text-brand-primary">
                      {policy.title || "Untitled Policy"}
                    </h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-semantic-neutral">
                      {policy.content || "No content available."}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-4">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
                      Open workflow
                    </span>
                    <span className="rounded-full bg-brand-faint px-3 py-1 text-sm font-extrabold text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
                      View
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
