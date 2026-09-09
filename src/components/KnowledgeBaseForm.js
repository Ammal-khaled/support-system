import { useEffect, useRef, useState } from "react";
import { addPolicy, deletePolicy, subscribePolicies, updatePolicy } from "../services/firestore";

const EMPTY_ROW = [""];
const FORM_TABS = ["Basics", "Guidance", "References"];

function cleanList(items) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function listForForm(items) {
  return Array.isArray(items) && items.length ? items : EMPTY_ROW;
}

function ListField({ label, description, items, onChange, addLabel, multiline = false }) {
  const updateItem = (index, value) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const removeItem = (index) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next.length ? next : EMPTY_ROW);
  };

  return (
    <fieldset>
      <legend className="label-field">{label}</legend>
      <p className="mb-3 text-xs leading-5 text-semantic-neutral">{description}</p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-start gap-2">
            <span className="mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-faint text-xs font-extrabold text-brand-primary">
              {index + 1}
            </span>
            {multiline ? (
              <textarea
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                rows={2}
                className="input-field resize-y"
              />
            ) : (
              <input
                type="text"
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                className="input-field"
              />
            )}
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="mt-1 min-h-[42px] shrink-0 rounded-xl px-3 text-sm font-bold text-semantic-error transition-colors hover:bg-red-50"
              aria-label={`Remove ${label.toLowerCase()} row ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-3 rounded-xl bg-brand-faint px-3 py-2 text-sm font-extrabold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white"
      >
        + {addLabel}
      </button>
    </fieldset>
  );
}

export default function KnowledgeBaseForm() {
  const formCardRef = useRef(null);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [formTab, setFormTab] = useState("Basics");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [customerQuestions, setCustomerQuestions] = useState(EMPTY_ROW);
  const [agentSteps, setAgentSteps] = useState(EMPTY_ROW);
  const [sourceFiles, setSourceFiles] = useState(EMPTY_ROW);
  const [keywords, setKeywords] = useState(EMPTY_ROW);
  const [asset, setAsset] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsubscribe = subscribePolicies(
      (data) => {
        setPolicies(data);
        setLoading(false);
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
    setTitle(policy.title || "");
    setContent(policy.content || "");
    setSummary(policy.summary || "");
    setCategory(policy.category || "");
    setPriority(policy.priority || "Medium");
    setCustomerQuestions(listForForm(policy.customerQuestions));
    setAgentSteps(listForForm(policy.agentSteps));
    setSourceFiles(listForForm(policy.sourceFiles));
    setKeywords(listForForm(policy.keywords));
    setAsset(policy.asset || "");
    setFormTab("Basics");
    setError("");
    setStatus("");
    if (process.env.NODE_ENV !== "test") {
      window.setTimeout(() => {
        formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const clearForm = () => {
    setSelectedPolicy(null);
    setTitle("");
    setContent("");
    setSummary("");
    setCategory("");
    setPriority("Medium");
    setCustomerQuestions(EMPTY_ROW);
    setAgentSteps(EMPTY_ROW);
    setSourceFiles(EMPTY_ROW);
    setKeywords(EMPTY_ROW);
    setAsset("");
    setFormTab("Basics");
    setError("");
  };

  const getPolicyInput = () => ({
    title: title.trim(),
    content: content.trim(),
    summary: summary.trim() || content.trim(),
    category: category.trim(),
    priority,
    customerQuestions: cleanList(customerQuestions),
    agentSteps: cleanList(agentSteps),
    sourceFiles: cleanList(sourceFiles),
    keywords: cleanList(keywords),
    asset: asset.trim(),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormTab("Basics");
      setError("Title and main policy content are required.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");
    const input = getPolicyInput();
    const success = selectedPolicy
      ? await updatePolicy(selectedPolicy.id, input)
      : await addPolicy(input);

    if (success) {
      const message = selectedPolicy ? "Policy updated." : "Policy added.";
      clearForm();
      setStatus(message);
    } else {
      setError("Could not save the policy. Please try again.");
    }
    setSaving(false);
  };

  const handleDeletePolicy = async () => {
    if (!selectedPolicy) return;
    if (!window.confirm(`Delete policy "${selectedPolicy.title}"? This cannot be undone.`)) return;
    const success = await deletePolicy(selectedPolicy.id);
    if (success) {
      clearForm();
      setStatus("Policy deleted.");
    } else {
      setError("Could not delete the policy. Please try again.");
    }
  };

  const visiblePolicies = policies.filter((policy) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [
      policy.id,
      policy.title,
      policy.content,
      policy.summary,
      policy.category,
      policy.priority,
      ...(policy.customerQuestions || []),
      ...(policy.agentSteps || []),
      ...(policy.sourceFiles || []),
      ...(policy.keywords || []),
    ].some((field) => String(field || "").toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      <div ref={formCardRef} className="glass-card scroll-mt-36 p-5 sm:p-8 lg:scroll-mt-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              {selectedPolicy ? "Edit Policy" : "Add New Policy"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-semantic-neutral">
              Build the searchable article and the structured call workflow in one place.
            </p>
          </div>
          <div className="admin-tab-shell">
            {FORM_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFormTab(tab)}
                className={`admin-tab px-4 py-2 ${
                  formTab === tab
                    ? "admin-tab-active"
                    : "admin-tab-inactive"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {status && <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-semantic-success">{status}</p>}
        {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-semantic-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          {formTab === "Basics" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="label-field">Title</label>
                <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} className="input-field" required />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className="label-field">Department / Category</label>
                  <input id="category" value={category} onChange={(event) => setCategory(event.target.value)} className="input-field" placeholder="e.g. Billing" />
                </div>
                <div>
                  <label htmlFor="priority" className="label-field">Priority</label>
                  <select id="priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="input-field">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="summary" className="label-field">Short Summary</label>
                <textarea id="summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} className="input-field resize-y" placeholder="A short description shown in search results." />
              </div>
              <div>
                <label htmlFor="content" className="label-field">Main Policy Content</label>
                <textarea id="content" value={content} onChange={(event) => setContent(event.target.value)} rows={5} className="input-field resize-y" required />
              </div>
            </div>
          )}

          {formTab === "Guidance" && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
              <ListField label="Ask First" description="Questions the agent should confirm before taking action." items={customerQuestions} onChange={setCustomerQuestions} addLabel="Add question" multiline />
              <ListField label="Do Next" description="The approved sequence the agent should follow." items={agentSteps} onChange={setAgentSteps} addLabel="Add step" multiline />
            </div>
          )}

          {formTab === "References" && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
              <ListField label="Source Documents" description="Document names agents can reference for this policy." items={sourceFiles} onChange={setSourceFiles} addLabel="Add source" />
              <ListField label="Search Keywords" description="Extra terms that help agents find this article." items={keywords} onChange={setKeywords} addLabel="Add keyword" />
              <div className="xl:col-span-2">
                <label htmlFor="asset" className="label-field">QR Code or Image URL</label>
                <input id="asset" value={asset} onChange={(event) => setAsset(event.target.value)} className="input-field" placeholder="/aquacool-assets/example.png or https://..." />
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap justify-end gap-2 border-t border-surface-border pt-5">
            {selectedPolicy && (
              <button type="button" onClick={handleDeletePolicy} className="btn-danger">Delete</button>
            )}
            <button type="button" onClick={clearForm} className="btn-secondary">Clear</button>
            <button type="submit" disabled={saving} className="btn-primary px-6">
              {saving ? "Saving..." : selectedPolicy ? "Update Policy" : "Add Policy"}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card p-5 sm:p-8">
        <h3 className="mb-4 text-xl font-extrabold text-slate-950">Existing Policies ({policies.length})</h3>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field mb-4"
          placeholder="Search policies by title, category, keyword, content, or ID..."
        />
        {loading ? (
          <p className="text-semantic-neutral">Loading policies...</p>
        ) : visiblePolicies.length === 0 ? (
          <p className="text-semantic-neutral">No policies match this search.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visiblePolicies.map((policy) => (
              <li key={policy.id}>
                <button
                  type="button"
                  onClick={() => handleSelectPolicy(policy)}
                  className={`h-full w-full rounded-card border p-4 text-left transition-all ${
                    selectedPolicy?.id === policy.id
                      ? "border-brand-primary bg-brand-faint/20"
                      : "border-surface-border bg-surface-card hover:border-brand-primary hover:bg-surface-panel"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-extrabold text-slate-900">{policy.title}</p>
                    {policy.priority && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-primary">{policy.priority}</span>}
                  </div>
                  {policy.category && <p className="mt-1 text-xs font-bold uppercase text-brand-primary">{policy.category}</p>}
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-semantic-neutral">{policy.summary || policy.content}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
