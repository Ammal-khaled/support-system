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
  critical: "bg-accent-coral/15 text-accent-coral border border-accent-coral/30",
  soft_skill: "bg-accent-amber/15 text-accent-amber border border-accent-amber/30",
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
    await deleteBannedPhrase(selected.id);
    clearForm();
  };

  return (
    <div className="space-y-6">
      <div className="card p-8">
        <h2 className="card-header mb-1">
          {selected ? "Edit Banned Phrase" : "Add Banned Phrase"}
        </h2>
        <p className="card-subtext mb-6">
          Define phrases agents should avoid and the preferred alternative.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Wrong Phrase</label>
            <input
              type="text"
              value={wrongPhrase}
              onChange={(e) => setWrongPhrase(e.target.value)}
              className="input-field"
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
              className="input-field"
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
                className="input-field"
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
                className="input-field"
                placeholder="e.g. escalation"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {selected && (
              <button type="button" onClick={handleDelete} className="btn-danger">
                Delete
              </button>
            )}
            <button type="button" onClick={clearForm} className="btn-secondary">
              Clear
            </button>
            <button type="submit" className="btn-primary px-6">
              {selected ? "Update Phrase" : "Add Phrase"}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-8">
        <h3 className="card-header mb-4">Existing Phrases ({phrases.length})</h3>

        {loading ? (
          <p className="text-text-muted">Loading phrases...</p>
        ) : error ? (
          <p className="text-accent-coral text-sm font-semibold">{error}</p>
        ) : phrases.length === 0 ? (
          <p className="text-text-muted">No banned phrases configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {phrases.map((phrase) => (
              <li
                key={phrase.id}
                onClick={() => handleSelect(phrase)}
                className={`p-4 rounded-enterprise cursor-pointer border transition-all ${
                  selected?.id === phrase.id
                    ? "border-accent-cyan bg-mission-bg"
                    : "border-mission-border hover:bg-mission-bg"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      severityBadge[phrase.severity] || "bg-mission-bg text-text-muted border border-mission-border"
                    }`}
                  >
                    {phrase.severity === "critical" ? "Critical" : "Soft Skill"}
                  </span>
                  {phrase.category && (
                    <span className="text-xs text-text-muted font-semibold">{phrase.category}</span>
                  )}
                </div>
                <p className="font-display font-semibold text-text-main">
                  &ldquo;{phrase.wrongPhrase}&rdquo;
                </p>
                <p className="text-sm text-text-muted mt-1">
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
