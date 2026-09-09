import { useState } from "react";
import { analyzeSoftSkills } from "../services/aiAnalyzer";
import { getBannedPhrases, getFlags, getPolicies } from "../services/firestore";

const sampleTranscript =
  "I can't help you with that refund. You have to wait until someone else checks it.";

export default function SoftSkillsEvaluator() {
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEvaluate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    setError("");
    setResult(null);

    try {
      const [bannedPhrases, kbArticles, qualityFlags] = await Promise.all([
        getBannedPhrases(),
        getPolicies(),
        getFlags(),
      ]);
      const analysis = await analyzeSoftSkills(transcript, {
        bannedPhrases,
        kbArticles,
        qualityFlags: qualityFlags.slice(0, 25),
      });

      setResult(analysis);
      setStatus("AI rule check completed. Nothing was saved to the review queue.");
    } catch (err) {
      console.error("Soft-skills evaluation failed:", err);
      setError(err.message || "AI coaching is unavailable. Check the Worker URL and deployment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="label-field">Quality AI Test</p>
          <h2 className="font-sans text-3xl font-semibold text-slate-900 tracking-tight">
            AI Rule Sandbox
          </h2>
          <p className="card-subtext max-w-2xl">
            Paste a transcript sample to preview how the after-call AI reads your current flag rules and knowledge base. This is only a test and does not save a flag.
          </p>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-brand-primary border border-brand-primary/40 bg-brand-primary/15 px-3 py-2 rounded-xl font-semibold">
          AI POST-CALL
        </span>
      </div>

      <form onSubmit={handleEvaluate} className="space-y-5">
        <div>
          <label className="label-field">Transcript Sample</label>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={7}
            className="input-field resize-y"
            required
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary px-8">
          {submitting ? "Analyzing..." : "Test AI Rules"}
        </button>
      </form>

      {status && (
        <div className="mt-6 border border-semantic-success/30 bg-semantic-success/15 text-semantic-success p-4 text-sm font-semibold rounded-xl">
          {status}
        </div>
      )}

      {error && (
        <div className="mt-6 border border-semantic-error/30 bg-semantic-error/15 text-semantic-error p-4 text-sm font-semibold rounded-xl">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 border border-surface-border bg-surface-bg p-5 rounded-xl">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span
              className={`text-xs uppercase tracking-[0.16em] px-2.5 py-1 rounded-full font-semibold ${
                result.isCompliant
                  ? "bg-semantic-success/15 text-semantic-success border border-semantic-success/30"
                  : "bg-semantic-warning/15 text-semantic-warning border border-semantic-warning/30"
              }`}
            >
              {result.isCompliant ? "Compliant" : "Coaching Needed"}
            </span>
            <span className="font-sans text-xs uppercase tracking-[0.16em] text-semantic-neutral font-semibold">
              {result.severity}
            </span>
          </div>
          <p className="text-semantic-neutral leading-relaxed">{result.feedback}</p>
        </div>
      )}
    </section>
  );
}

