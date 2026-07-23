import { useState, useEffect } from "react";
import { subscribePolicies } from "../services/firestore";
import { useAuth } from "../context/AuthContext";
import ActionSelector from "../components/ActionSelector";
import Sidebar from "../components/Sidebar";

export default function AgentDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredPolicies = policies.filter((policy) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = policy.title?.toLowerCase().includes(q);
    const contentMatch = policy.content?.toLowerCase().includes(q);
    const categoryMatch = policy.category?.toLowerCase().includes(q);
    return titleMatch || contentMatch || categoryMatch;
  });

  const greeting = userProfile?.name || "Agent";

  return (
    <div className="page-bg flex">
      <Sidebar />

      <div className="flex-1 ml-[260px] p-8">
        <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h2 className="page-title">Knowledge Base</h2>
          <p className="page-subtitle">Welcome, {greeting}. Search policies and log actions during your call.</p>
        </header>

        <ActionSelector />

        <div className="mb-8">
          <input
            type="text"
            placeholder="Search policies by title, content, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field text-base"
          />
        </div>

        {loading ? (
          <p className="text-text-muted text-center py-8">Loading policies...</p>
        ) : error ? (
          <div className="card p-8 text-center">
            <p className="text-accent-coral font-semibold">{error}</p>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-text-muted">
              {searchQuery ? "No policies found matching your search." : "No policies in the knowledge base yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPolicies.map((policy) => (
              <article key={policy.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-display text-xl font-semibold text-text-main">
                    {policy.title || "Untitled Policy"}
                  </h3>
                  {policy.category && (
                    <span className="shrink-0 text-xs font-semibold text-accent-cyan bg-mission-bg border border-mission-border px-2.5 py-1 rounded-full">
                      {policy.category}
                    </span>
                  )}
                </div>
                <p className="text-text-muted leading-relaxed">{policy.content || "No content available."}</p>
              </article>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
