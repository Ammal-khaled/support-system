import { useState, useEffect } from "react";
import {
  addBannedPhrase,
  deleteBannedPhrase,
  subscribeBannedPhrases,
  updateBannedPhrase,
} from "../services/firestore";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "soft_skill", label: "Soft Skill" },
];

const severityBadge = {
  critical: "bg-semantic-error/15 text-semantic-error border border-semantic-error/30",
  soft_skill: "bg-semantic-warning/15 text-semantic-warning border border-semantic-warning/30",
};

export default function BannedPhrasesManager() {
  const [phrases, setPhrases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [wrongPhrase, setWrongPhrase] = useState("");
  const [correctPhrase, setCorrectPhrase] = useState("");
  const [severity, setSeverity] = useState("critical");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeBannedPhrases(
      (data) => {
        setPhrases(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load banned phrases.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const clearForm = () => {
    setSelected(null);
    setWrongPhrase("");
    setCorrectPhrase("");
    setSeverity("critical");
    setCategory("");
  };

  const handleSelect = (phrase) => {
    setSelected(phrase);
    setWrongPhrase(phrase.wrongPhrase);
    setCorrectPhrase(phrase.correctPhrase);
    setSeverity(phrase.severity || "critical");
    setCategory(phrase.category || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wrongPhrase.trim() || !correctPhrase.trim()) return;

    if (selected) {
      await updateBannedPhrase(
        selected.id,
        wrongPhrase.trim(),
        correctPhrase.trim(),
        severity,
        category.trim()
      );
    } else {
      await addBannedPhrase(wrongPhrase.trim(), correctPhrase.trim(), severity, category.trim());
    }

    clearForm();
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete phrase "${selected.wrongPhrase}"? This cannot be undone.`)) return;
    const success = await deleteBannedPhrase(selected.id);
    if (success) clearForm();
    else setError("Could not delete the phrase. Please try again.");
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 sm:p-8">
        <h2 className="text-xl font-extrabold text-slate-950 mb-1">
          {selected ? "Edit Banned Phrase" : "Add Banned Phrase"}
        </h2>
        <p className="text-sm leading-6 text-semantic-neutral mb-6">
          Define phrases agents should avoid and the preferred alternative.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Wrong Phrase</label>
            <input
              type="text"
              value={wrongPhrase}
              onChange={(e) => setWrongPhrase(e.target.value)}
              className="w-full rounded-2xl border border-white/80 bg-white/75 p-3 text-sm font-medium text-slate-900 shadow-sm backdrop-blur outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-faint"
              placeholder="e.g. i can't help you"
              required
            />
          </div>
          <div>
            <label className="label-field">Correct Alternative</label>
            <input
              type="text"
              value={correctPhrase}
              onChange={(e) => setCorrectPhrase(e.target.value)}
              className="w-full rounded-2xl border border-white/80 bg-white/75 p-3 text-sm font-medium text-slate-900 shadow-sm backdrop-blur outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-faint"
              placeholder="Preferred phrasing"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/75 p-3 text-sm font-medium text-slate-900 shadow-sm backdrop-blur outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-faint"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/75 p-3 text-sm font-medium text-slate-900 shadow-sm backdrop-blur outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-faint"
                placeholder="e.g. escalation"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {selected && (
              <button type="button" onClick={handleDelete} className="min-h-[48px] rounded-2xl bg-semantic-error px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600">
                Delete
              </button>
            )}
            <button type="button" onClick={clearForm} className="min-h-[48px] rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white">
              Clear
            </button>
            <button type="submit" className="min-h-[48px] rounded-2xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60 px-6">
              {selected ? "Update Phrase" : "Add Phrase"}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card p-5 sm:p-8">
        <h3 className="text-xl font-extrabold text-slate-950 mb-4">Existing Phrases ({phrases.length})</h3>

        {loading ? (
          <p className="text-semantic-neutral">Loading phrases...</p>
        ) : error ? (
          <p className="text-semantic-error text-sm font-semibold">{error}</p>
        ) : phrases.length === 0 ? (
          <p className="text-semantic-neutral">No banned phrases configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {phrases.map((phrase) => (
              <li
                key={phrase.id}
                onClick={() => handleSelect(phrase)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selected?.id === phrase.id
                    ? "border-brand-primary bg-surface-bg"
                    : "border-surface-border hover:bg-surface-bg"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      severityBadge[phrase.severity] || "bg-surface-bg text-semantic-neutral border border-surface-border"
                    }`}
                  >
                    {phrase.severity === "critical" ? "Critical" : "Soft Skill"}
                  </span>
                  {phrase.category && (
                    <span className="text-xs text-semantic-neutral font-semibold">{phrase.category}</span>
                  )}
                </div>
                <p className="font-sans font-semibold text-slate-900">
                  &ldquo;{phrase.wrongPhrase}&rdquo;
                </p>
                <p className="text-sm text-semantic-neutral mt-1">
                  Use: &ldquo;{phrase.correctPhrase}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

