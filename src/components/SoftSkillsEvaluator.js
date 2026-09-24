import { useRef, useState } from "react";
import { analyzeSoftSkills } from "../services/aiAnalyzer";
import { addAfterCallReport, getBannedPhrases, getFlags, getPolicies } from "../services/firestore";
import { useAuth } from "../context/AuthContext";

export default function SoftSkillsEvaluator() {
  const { currentUser, userProfile } = useAuth();
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(null);
  const [activeFileName, setActiveFileName] = useState("");
  const [activeFileType, setActiveFileType] = useState("");
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        resolve(value.includes(",") ? value.split(",").pop() : value);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (file) => {
    setRecording(null);
    setActiveFileName("");
    setActiveFileType("");
    setError("");
    if (!file) return;

    if (file.type.startsWith("text/") || /\.(txt|vtt|srt)$/i.test(file.name)) {
      setTranscript(await file.text());
      setActiveFileName(file.name);
      setActiveFileType("text");
      setStatus(`Loaded transcript file: ${file.name}`);
      return;
    }

    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|webm|ogg)$/i.test(file.name)) {
      setError("Upload a transcript text file or an audio recording.");
      return;
    }

    setRecording(file);
    setTranscript("");
    setActiveFileName(file.name);
    setActiveFileType("audio");
    setStatus(`Recording ready for AI analysis: ${file.name}`);
  };

  const handleTranscriptChange = (event) => {
    setTranscript(event.target.value);
    if (recording || activeFileName) {
      setRecording(null);
      setActiveFileName("");
      setActiveFileType("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    setRecording(null);
    if (activeFileType === "text") setTranscript("");
    setActiveFileName("");
    setActiveFileType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus("");
  };

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
      // The sandbox always sends one source: transcript text OR audio, never both.
      const audioPayload = recording
        ? {
            audioBase64: await fileToBase64(recording),
            audioMimeType: recording.type || "audio/mpeg",
            audioFileName: recording.name,
          }
        : {};
      const analysis = await analyzeSoftSkills(recording ? "" : transcript, {
        ...audioPayload,
        bannedPhrases,
        kbArticles,
        qualityFlags: qualityFlags.slice(0, 25),
      });

      setResult(analysis);
      await addAfterCallReport({
        agentId: currentUser?.uid || "sandbox",
        agentName: userProfile?.name || currentUser?.displayName || currentUser?.email || "Sandbox User",
        transcriptSnippet: recording ? "Audio recording analyzed by AI." : transcript,
        audioFileName: recording?.name || "",
        result: analysis,
      });
      setStatus("AI analysis completed and saved to After-Call Reports for QA export.");
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
            Paste a transcript or upload a call recording to preview how the after-call AI reads your current flag rules and knowledge base. This is only a test and does not save a flag.
          </p>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-brand-primary border border-brand-primary/40 bg-brand-primary/15 px-3 py-2 rounded-xl font-semibold">
          AI POST-CALL
        </span>
      </div>

      <form onSubmit={handleEvaluate} className="space-y-5">
        <div>
          <label className="label-field">Upload Recording or Transcript</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.txt,.vtt,.srt,text/plain"
            onChange={(event) => handleFileUpload(event.target.files?.[0])}
            className="input-field mt-2"
          />
          {activeFileName && (
            <div className="mt-2 flex items-center gap-3 text-sm font-semibold text-semantic-neutral">
              <span className="truncate">Selected: {activeFileName}</span>
              <button type="button" onClick={handleRemoveFile} className="btn-secondary px-3 py-1 text-xs">
                Remove
              </button>
            </div>
          )}
          <p className="mt-2 text-xs font-semibold text-semantic-neutral">
            Audio files are sent to AI for transcription and analysis. Text files load into the transcript box below.
          </p>
        </div>

        <div>
          <label className="label-field">Transcript</label>
          <textarea
            value={transcript}
            onChange={handleTranscriptChange}
            placeholder="Paste or type a transcript to analyze it."
            rows={7}
            className="input-field resize-y"
            required={!recording}
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary px-8">
          {submitting ? "Analyzing..." : recording ? "Analyze Recording" : "Test AI Rules"}
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
          {result.summary && (
            <p className="mt-3 text-sm font-semibold text-slate-900">{result.summary}</p>
          )}
          {result.incorrectInformation?.length > 0 && (
            <div className="mt-4 rounded-xl border border-semantic-error/20 bg-semantic-error/10 p-4">
              <p className="label-field text-semantic-error">Wrong info</p>
              <ul className="mt-2 space-y-2 text-sm text-semantic-neutral">
                {result.incorrectInformation.map((item, index) => (
                  <li key={`${item.claim || "wrong-info"}-${index}`}>
                    <span className="font-bold text-slate-900">{item.claim || "Incorrect claim"}</span>
                    {" -> "}
                    {item.expected || item.correction || "Correct policy not provided."}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.recommendations?.length > 0 && (
            <div className="mt-4">
              <p className="label-field">Recommendations</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-semantic-neutral">
                {result.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

