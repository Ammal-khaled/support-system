import { useState } from "react";
import { analyzeSoftSkills } from "../services/aiAnalyzer";
import { addSoftSkillFlag } from "../services/firestore";

const sampleTranscript =
  "I can't help you with that refund. You have to wait until someone else checks it.";

export default function SoftSkillsEvaluator() {
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [agentName, setAgentName] = useState("Demo Agent");
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
      const analysis = await analyzeSoftSkills(transcript);

      await addSoftSkillFlag({
        agentId: "manual_tier_2_test",
        agentName: agentName.trim() || "Demo Agent",
        matchedPhrase: analysis.isCompliant ? "Compliant soft-skills review" : "Coaching opportunity",
        transcriptSnippet: transcript.trim(),
        feedback: analysis.feedback,
      });

      setResult(analysis);
      setStatus("Saved soft-skills evaluation to the flags feed.");
    } catch (err) {
      console.error("Soft-skills evaluation failed:", err);
      setError(
        "AI coaching is unavailable or has not been enabled yet. Please contact your team lead."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="label-field">Tier 2 Prototype</p>
          <h2 className="font-sans text-3xl font-semibold text-slate-900 tracking-tight">
            Soft-Skills AI Coaching
          </h2>
          <p className="card-subtext max-w-2xl">
            Test post-call transcript review. This writes coaching output to Firestore as a soft-skill flag.
          </p>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-brand-primary border border-brand-primary/40 bg-brand-primary/15 px-3 py-2 rounded-xl font-semibold">
          AI POST-CALL
        </span>
      </div>

      <form onSubmit={handleEvaluate} className="space-y-5">
        <div>
          <label className="label-field">Agent Name</label>
          <input
            type="text"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">Transcript Snippet</label>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={7}
            className="input-field resize-y"
            required
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary px-8">
          {submitting ? "Analyzing..." : "Run Soft-Skills Evaluation"}
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

