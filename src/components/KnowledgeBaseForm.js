import { useState, useEffect } from "react";
import { addPolicy, deletePolicy, subscribePolicies, updatePolicy } from "../services/firestore";

export default function KnowledgeBaseForm() {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribePolicies(
      (data) => {
        setPolicies(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load knowledge base records.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleSelectPolicy = (policy) => {
    setSelectedPolicy(policy);
    setTitle(policy.title);
    setContent(policy.content);
    setCategory(policy.category || "");
  };

  const clearForm = () => {
    setSelectedPolicy(null);
    setTitle("");
    setContent("");
    setCategory("");
  };

  const handleAddPolicy = async (e) => {
    e.preventDefault();
    if (title && content) {
      const success = await addPolicy(title.trim(), content.trim(), category.trim());
      if (success) clearForm();
    }
  };

  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    if (selectedPolicy && title && content) {
      const success = await updatePolicy(selectedPolicy.id, title.trim(), content.trim(), category.trim());
      if (success) clearForm();
    }
  };

  const handleDeletePolicy = async () => {
    if (selectedPolicy) {
      const success = await deletePolicy(selectedPolicy.id);
      if (success) clearForm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-8">
        <h2 className="card-header mb-1">
          {selectedPolicy ? "Edit Policy" : "Add New Policy"}
        </h2>
        <p className="card-subtext mb-6">
          Create or update knowledge base articles agents can search during calls.
        </p>

        <form onSubmit={selectedPolicy ? handleUpdatePolicy : handleAddPolicy} className="space-y-4">
          <div>
            <label htmlFor="title" className="label-field">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label htmlFor="content" className="label-field">Content</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows="4"
              className="input-field resize-y"
              required
            />
          </div>
          <div>
            <label htmlFor="category" className="label-field">Category</label>
            <input
              type="text"
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
              placeholder="e.g. billing, clearance, account"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {selectedPolicy && (
              <button type="button" onClick={handleDeletePolicy} className="btn-danger">
                Delete
              </button>
            )}
            <button type="button" onClick={clearForm} className="btn-secondary">
              Clear
            </button>
            <button type="submit" className="btn-primary px-6">
              {selectedPolicy ? "Update Policy" : "Add Policy"}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-8">
        <h3 className="card-header mb-4">Existing Policies ({policies.length})</h3>

        {loading ? (
          <p className="text-text-muted">Loading policies...</p>
        ) : error ? (
          <p className="text-accent-coral text-sm font-semibold">{error}</p>
        ) : policies.length === 0 ? (
          <p className="text-text-muted">No policies in the knowledge base yet.</p>
        ) : (
          <ul className="space-y-2">
            {policies.map((policy) => (
              <li
                key={policy.id}
                onClick={() => handleSelectPolicy(policy)}
                className={`p-4 rounded-enterprise cursor-pointer border transition-all ${
                  selectedPolicy?.id === policy.id
                    ? "border-accent-cyan bg-mission-bg"
                    : "border-mission-border hover:bg-mission-bg"
                }`}
              >
                <p className="font-display font-semibold text-text-main">{policy.title}</p>
                {policy.category && (
                  <span className="inline-block mt-1 text-xs font-semibold text-accent-cyan bg-mission-bg border border-mission-border px-2 py-0.5 rounded-full">
                    {policy.category}
                  </span>
                )}
                <p className="text-sm text-text-muted mt-2 line-clamp-2">{policy.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
