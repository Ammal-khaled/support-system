const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
const GEMINI_MODEL = "gemini-1.5-flash";

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

const SYSTEM_PROMPT = `You are a CSR Soft-Skills Coach reviewing a saved post-call transcript snippet.

You are Tier 2 only. Do not evaluate real-time critical policy violations. Do not do keyword flagging for Tier 1. Your job is to evaluate tone, empathy, ownership, clarity, and professionalism.

Rules to check:
${SOFT_SKILL_RULES.map((rule) => `- Never say "${rule.avoid}". Coach toward: "${rule.prefer}"`).join("\n")}

Return only valid JSON with this exact shape:
{
  "isCompliant": boolean,
  "feedback": "one concise coaching tip",
  "severity": "soft_skill"
}`;

function extractJson(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Gemini response did not include JSON.");
  }

  return JSON.parse(match[0]);
}

function normalizeResult(result) {
  return {
    isCompliant: Boolean(result.isCompliant),
    feedback: String(result.feedback || "Review this interaction for empathy and ownership."),
    severity: "soft_skill",
  };
}

export async function analyzeSoftSkills(transcriptSnippet) {
  if (!transcriptSnippet?.trim()) {
    throw new Error("Transcript snippet is required.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Evaluate this CSR transcript snippet for soft skills only:\n\n${transcriptSnippet}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini response was empty.");
  }

  return normalizeResult(extractJson(text));
}

export { SOFT_SKILL_RULES };
