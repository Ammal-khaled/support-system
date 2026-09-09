const AI_WORKER_URL = process.env.REACT_APP_AI_WORKER_URL || "";

const SOFT_SKILL_RULES = [
  {
    avoid: "I can't help you",
    prefer: "I apologize for the inconvenience. Let me see what options are available.",
  },
  {
    avoid: "That's not my problem",
    prefer: "I understand why this matters. I will help route this to the right next step.",
  },
  {
    avoid: "You have to wait",
    prefer: "Thank you for your patience. I can share the expected next step and timeline.",
  },
  {
    avoid: "Calm down",
    prefer: "I can hear this is frustrating. I am here with you and will help.",
  },
];

function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return JSON.parse(cleaned);
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Gemini response did not include JSON.");
  }

  return JSON.parse(match[0]);
}

function normalizeResult(result) {
  const feedback = result.feedback || result.softSkills?.feedback;
  return {
    isCompliant: typeof result.isCompliant === "boolean"
      ? result.isCompliant
      : result.overallStatus === "clear",
    feedback: String(feedback || result.summary || "Review this interaction for empathy and ownership."),
    severity: "soft_skill",
  };
}

export async function analyzeSoftSkills(transcriptSnippet, context = {}) {
  if (typeof transcriptSnippet !== "string" || !transcriptSnippet.trim()) {
    throw new Error("Transcript snippet is required.");
  }

  if (!AI_WORKER_URL) {
    throw new Error("AI coaching is not configured. Set REACT_APP_AI_WORKER_URL.");
  }

  const response = await fetch(
    AI_WORKER_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcriptSnippet: transcriptSnippet.trim(),
        bannedPhrases: Array.isArray(context.bannedPhrases) ? context.bannedPhrases : [],
        kbArticles: Array.isArray(context.kbArticles) ? context.kbArticles : [],
        qualityFlags: Array.isArray(context.qualityFlags) ? context.qualityFlags : [],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const text = data.feedback ? JSON.stringify(data) : data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini response was empty.");
  }

  return normalizeResult(extractJson(text));
}

export { SOFT_SKILL_RULES };
