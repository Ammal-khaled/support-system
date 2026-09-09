importScripts("auth.js");
const FIREBASE_PROJECT_ID = "csr-support-system";
// Replace with the final Netlify URL after the first deploy.
const DASHBOARD_URL = "https://aquacooldesk.netlify.app";
const AI_WORKER_URL = "https://aquadesk-ai.aquadesk-support.workers.dev";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
const CALL_TRANSCRIPT_KEY = "activeCallTranscript";

function generateFirestoreId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

function getStringField(fields, name) {
  return fields?.[name]?.stringValue || "";
}

function getBooleanField(fields, name) {
  return Boolean(fields?.[name]?.booleanValue);
}

async function fetchCollection(collectionName) {
  try {
    const session = await getAuthSession();
    const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}`, {
      headers: { Authorization: `Bearer ${session.idToken}` },
    });
    if (!response.ok)
      throw new Error(`Could not load ${collectionName}: ${response.status}`);
    const data = await response.json();

    if (!data.documents) return [];

    return data.documents.map((document) => ({
      id: document.name.split("/").pop(),
      fields: document.fields || {},
    }));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    throw error;
  }
}

async function getBannedPhrases() {
  const documents = await fetchCollection("banned_phrases");

  return documents.map((document) => ({
    id: document.id,
    wrongPhrase: getStringField(document.fields, "wrongPhrase"),
    correctPhrase: getStringField(document.fields, "correctPhrase"),
    severity: getStringField(document.fields, "severity"),
    category: getStringField(document.fields, "category"),
  }));
}

async function getKbArticles() {
  const documents = await fetchCollection("knowledge_base");

  return documents.map((document) => ({
    id: document.id,
    title: getStringField(document.fields, "title"),
    content: getStringField(document.fields, "content"),
  }));
}

async function getQualityFlagsForAgent(agentId) {
  const session = await getAuthSession();
  const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.idToken}`,
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "flags" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "agentId" },
            op: "EQUAL",
            value: { stringValue: agentId },
          },
        },
        limit: 25,
      },
    }),
  });

  if (!response.ok) throw new Error(`Could not load quality flags: ${response.status}`);
  const rows = await response.json();

  return rows
    .map((row) => row.document)
    .filter(Boolean)
    .map((document) => {
      const fields = document.fields || {};
      return {
        id: document.name.split("/").pop(),
        type: getStringField(fields, "type"),
        matchedPhrase: getStringField(fields, "matchedPhrase"),
        transcriptSnippet: getStringField(fields, "transcriptSnippet"),
        feedback: getStringField(fields, "feedback"),
        reviewed: getBooleanField(fields, "reviewed"),
      };
    });
}


function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSnippet(transcript, matchedPhrase) {
  const sentencePattern = /[^.!?]+[.!?]?/g;
  const sentences = transcript.match(sentencePattern) || [transcript];
  const normalizedPhrase = matchedPhrase.toLowerCase();
  const matchIndex = sentences.findIndex((sentence) =>
    sentence.toLowerCase().includes(normalizedPhrase),
  );

  if (matchIndex === -1) {
    return transcript.slice(0, 240);
  }

  return sentences
    .slice(matchIndex, matchIndex + 2)
    .join(" ")
    .trim()
    .slice(0, 240);
}

function findPhraseMatch(transcript, phrases) {
  const normalizedTranscript = transcript.toLowerCase();

  return phrases.find((phrase) => {
    if (!phrase.wrongPhrase) return false;
    const pattern = new RegExp(
      `\\b${escapeRegExp(phrase.wrongPhrase.toLowerCase())}\\b`,
      "i",
    );
    return pattern.test(normalizedTranscript);
  });
}

function findKbFactMismatch(transcript, kbArticles) {
  const timelinePattern =
    /\b(\d{1,3})\s*(day|days|hour|hours|week|weeks|month|months)\b/i;
  const transcriptFact = transcript.match(timelinePattern);

  if (!transcriptFact) return null;

  for (const article of kbArticles) {
    const articleFact = article.content.match(timelinePattern);

    if (!articleFact) continue;

    const transcriptValue = `${transcriptFact[1]} ${transcriptFact[2].toLowerCase()}`;
    const articleValue = `${articleFact[1]} ${articleFact[2].toLowerCase()}`;

    if (transcriptValue !== articleValue) {
      return {
        wrongPhrase: transcriptValue,
        correctPhrase: articleValue,
        severity: "critical",
        category: "kb_fact_mismatch",
        kbArticleId: article.id,
      };
    }
  }

  return null;
}

async function getAgentContext() {
  const session = await getAuthSession();
  return {
    agentId: session.uid,
    agentName: session.name,
  };
}

async function writeFlag({
  agentId,
  agentName,
  type,
  matchedPhrase,
  kbArticleId,
  transcriptSnippet,
}) {
  const documentId = generateFirestoreId();
  const session = await getAuthSession();
  if (agentId !== session.uid)
    throw new Error("Extension account changed. Please retry.");
  const response = await fetch(FIRESTORE_COMMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.idToken}`,
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/flags/${documentId}`,
            fields: {
              agentId: { stringValue: agentId },
              agentName: { stringValue: agentName },
              type: { stringValue: type },
              matchedPhrase: { stringValue: matchedPhrase },
              kbArticleId: kbArticleId
                ? { stringValue: kbArticleId }
                : { nullValue: null },
              transcriptSnippet: { stringValue: transcriptSnippet },
              reviewed: { booleanValue: false },
            },
          },
          updateTransforms: [
            {
              fieldPath: "timestamp",
              setToServerValue: "REQUEST_TIME",
            },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Flag write failed: ${response.status}`);
  return documentId;
}

async function createCriticalTicket(flagId, agentContext, matchedPhrase) {
  const session = await getAuthSession();
  if (session.uid !== agentContext.agentId)
    throw new Error("Extension account changed.");
  const response = await fetch(FIRESTORE_COMMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.idToken}`,
    },
    body: JSON.stringify({
      writes: [
        {
          currentDocument: { exists: false },
          update: {
            name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/tickets/critical_${flagId}`,
            fields: {
              title: {
                stringValue: `Critical phrase: ${matchedPhrase.slice(0, 160)}`,
              },
              status: { stringValue: "Open" },
              priority: { stringValue: "High" },
              department: { stringValue: "Quality" },
              source: { stringValue: "critical_flag" },
              flagId: { stringValue: flagId },
              flagRef: {
                referenceValue: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/flags/${flagId}`,
              },
              createdById: { stringValue: agentContext.agentId },
              createdByName: { stringValue: agentContext.agentName },
              description: {
                stringValue:
                  "Review the linked critical flag and coach the agent.",
              },
            },
          },
          updateTransforms: ["createdAt", "updatedAt"].map((fieldPath) => ({
            fieldPath,
            setToServerValue: "REQUEST_TIME",
          })),
        },
      ],
    }),
  });
  if (!response.ok) {
    const data = await response.json();
    if (data.error?.status !== "ALREADY_EXISTS")
      throw new Error(`Ticket write failed: ${response.status}`);
  }
}

async function checkCritical(
  transcript,
  bannedPhrases,
  kbArticles,
  agentContext,
  sender,
) {
  const criticalPhrases = bannedPhrases.filter(
    (phrase) => phrase.severity === "critical",
  );
  const phraseMatch = findPhraseMatch(transcript, criticalPhrases);
  const kbMismatch = findKbFactMismatch(transcript, kbArticles);
  const match = phraseMatch || kbMismatch;

  if (!match) return;

  const matchedPhrase = match.wrongPhrase;
  const transcriptSnippet = extractSnippet(transcript, matchedPhrase);

  const flagId = await writeFlag({
    ...agentContext,
    type: "critical",
    matchedPhrase,
    kbArticleId: match.kbArticleId || null,
    transcriptSnippet,
  });

  if (sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, {
      type: "SHOW_WARNING",
      severity: "critical",
      matchedPhrase,
      knowledgeBaseUrl: match.kbArticleId
        ? `${DASHBOARD_URL}/agent/policies/${encodeURIComponent(match.kbArticleId)}`
        : null,
      message: match.correctPhrase
        ? `Critical policy alert: replace "${matchedPhrase}" with "${match.correctPhrase}".`
        : `Critical policy alert: "${matchedPhrase}" conflicts with the live knowledge base.`,
    });
  }
  await createCriticalTicket(flagId, agentContext, matchedPhrase);
}

async function logSoftSkill(transcript, bannedPhrases, agentContext) {
  const softSkillPhrases = bannedPhrases.filter(
    (phrase) => phrase.severity === "soft_skill",
  );
  const match = findPhraseMatch(transcript, softSkillPhrases);

  if (!match) return;

  await writeFlag({
    ...agentContext,
    type: "soft_skill",
    matchedPhrase: match.wrongPhrase,
    kbArticleId: null,
    transcriptSnippet: extractSnippet(transcript, match.wrongPhrase),
  });
}

async function getActiveTranscript() {
  const stored = await chrome.storage.session.get(CALL_TRANSCRIPT_KEY);
  return String(stored[CALL_TRANSCRIPT_KEY] || "").trim();
}

async function appendTranscript(transcript) {
  const existing = await getActiveTranscript();
  const combined = [existing, transcript.trim()].filter(Boolean).join(" ");
  await chrome.storage.session.set({ [CALL_TRANSCRIPT_KEY]: combined.slice(-50000) });
  return combined;
}

async function analyzeAfterCall(transcript, bannedPhrases, kbArticles, qualityFlags, agentContext) {
  const response = await fetch(AI_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, bannedPhrases, kbArticles, qualityFlags }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `AI analysis failed: ${response.status}`);
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("AI returned an empty after-call report.");

  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI returned an invalid after-call report.");

  return { ...JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)), ...agentContext };
}

async function writeAfterCallReport(report) {
  const documentId = generateFirestoreId();
  const session = await getAuthSession();
  if (session.uid !== report.agentId) throw new Error("Extension account changed.");

  const jsonField = (value) => ({ stringValue: JSON.stringify(value ?? null) });
  const response = await fetch(FIRESTORE_COMMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.idToken}` },
    body: JSON.stringify({
      writes: [{
        update: {
          name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/after_call_reports/${documentId}`,
          fields: {
            agentId: { stringValue: report.agentId },
            agentName: { stringValue: report.agentName },
            transcript: { stringValue: report.transcript || "" },
            summary: { stringValue: report.summary || "" },
            overallStatus: { stringValue: report.overallStatus || "coaching_needed" },
            severity: { stringValue: report.severity || "none" },
            softSkills: jsonField(report.softSkills),
            bannedPhrases: jsonField(report.bannedPhrases),
            incorrectInformation: jsonField(report.incorrectInformation),
            recommendations: jsonField(report.recommendations),
            status: { stringValue: "open" },
            source: { stringValue: "extension_after_call" },
          },
        },
        updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      }],
    }),
  });
  if (!response.ok) throw new Error(`After-call report write failed: ${response.status}`);
  return documentId;
}

async function finishCallAndAnalyze() {
  const transcript = await getActiveTranscript();
  if (!transcript) throw new Error("No transcript has been captured for this call.");

  const agentContext = await getAgentContext();
  const [bannedPhrases, kbArticles, qualityFlags] = await Promise.all([
    getBannedPhrases(),
    getKbArticles(),
    getQualityFlagsForAgent(agentContext.agentId),
  ]);
  const report = await analyzeAfterCall(transcript, bannedPhrases, kbArticles, qualityFlags, agentContext);
  report.transcript = transcript;
  const reportId = await writeAfterCallReport(report);
  await chrome.storage.session.remove(CALL_TRANSCRIPT_KEY);
  return { reportId, summary: report.summary, severity: report.severity };
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("CSR Support Extension installed and ready.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_CALL_STATUS") {
    getActiveTranscript()
      .then((transcript) => sendResponse({ status: "ready", characters: transcript.length }))
      .catch((error) => sendResponse({ status: "error", message: error.message }));
    return true;
  }

  if (request.type === "END_CALL_ANALYSIS") {
    finishCallAndAnalyze()
      .then((result) => sendResponse({ status: "complete", ...result }))
      .catch((error) => sendResponse({ status: "error", message: error.message }));
    return true;
  }

  if (request.type === "CHECK_TRANSCRIPT") {
    const transcript = String(request.payload || "").trim();

    if (!transcript) {
      sendResponse({ status: "ignored" });
      return true;
    }

    appendTranscript(transcript)
      .then(() => Promise.all([getBannedPhrases(), getKbArticles(), getAgentContext()]))
      .then(([bannedPhrases, kbArticles, agentContext]) =>
        Promise.all([
          checkCritical(
            transcript,
            bannedPhrases,
            kbArticles,
            agentContext,
            sender,
          ),
          logSoftSkill(transcript, bannedPhrases, agentContext),
        ]),
      )
      .then(() => sendResponse({ status: "complete" }))
      .catch((error) => {
        console.error("Error checking transcript:", error);
        sendResponse({ status: "error", message: error.message });
      });
  }

  return true;
});
