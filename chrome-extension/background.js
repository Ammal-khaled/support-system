importScripts("auth.js");
const FIREBASE_PROJECT_ID = "csr-support-system";
// Replace with the final Netlify URL after the first deploy.
const DASHBOARD_URL = "https://YOUR-NETLIFY-SITE.netlify.app";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_COMMIT_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;

function generateFirestoreId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

function getStringField(fields, name) {
  return fields?.[name]?.stringValue || "";
}

async function fetchCollection(collectionName) {
  try {
    const session = await getAuthSession();
    const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}`, {
      headers: { Authorization: `Bearer ${session.idToken}` },
    });
    if (!response.ok) throw new Error(`Could not load ${collectionName}: ${response.status}`);
    const data = await response.json();

    if (!data.documents) return [];

    return data.documents.map((document) => ({
      id: document.name.split("/").pop(),
      fields: document.fields || {}
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
    category: getStringField(document.fields, "category")
  }));
}

async function getKbArticles() {
  const documents = await fetchCollection("knowledge_base");

  return documents.map((document) => ({
    id: document.id,
    title: getStringField(document.fields, "title"),
    content: getStringField(document.fields, "content")
  }));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSnippet(transcript, matchedPhrase) {
  const sentencePattern = /[^.!?]+[.!?]?/g;
  const sentences = transcript.match(sentencePattern) || [transcript];
  const normalizedPhrase = matchedPhrase.toLowerCase();
  const matchIndex = sentences.findIndex((sentence) =>
    sentence.toLowerCase().includes(normalizedPhrase)
  );

  if (matchIndex === -1) {
    return transcript.slice(0, 240);
  }

  return sentences.slice(matchIndex, matchIndex + 2).join(" ").trim().slice(0, 240);
}

function findPhraseMatch(transcript, phrases) {
  const normalizedTranscript = transcript.toLowerCase();

  return phrases.find((phrase) => {
    if (!phrase.wrongPhrase) return false;
    const pattern = new RegExp(`\\b${escapeRegExp(phrase.wrongPhrase.toLowerCase())}\\b`, "i");
    return pattern.test(normalizedTranscript);
  });
}

function findKbFactMismatch(transcript, kbArticles) {
  const timelinePattern = /\b(\d{1,3})\s*(day|days|hour|hours|week|weeks|month|months)\b/i;
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
        kbArticleId: article.id
      };
    }
  }

  return null;
}

async function getAgentContext() {
  const session = await getAuthSession();
  return {
    agentId: session.uid,
    agentName: session.name
  };
}

async function writeFlag({ agentId, agentName, type, matchedPhrase, kbArticleId, transcriptSnippet }) {
  const documentId = generateFirestoreId();
  const session = await getAuthSession();
  if (agentId !== session.uid) throw new Error("Extension account changed. Please retry.");
  const response = await fetch(FIRESTORE_COMMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.idToken}`
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
              kbArticleId: kbArticleId ? { stringValue: kbArticleId } : { nullValue: null },
              transcriptSnippet: { stringValue: transcriptSnippet },
              reviewed: { booleanValue: false }
            }
          },
          updateTransforms: [
            {
              fieldPath: "timestamp",
              setToServerValue: "REQUEST_TIME"
            }
          ]
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`Flag write failed: ${response.status}`);
  return documentId;
}

async function createCriticalTicket(flagId, agentContext, matchedPhrase) {
  const session = await getAuthSession();
  if (session.uid !== agentContext.agentId) throw new Error("Extension account changed.");
  const response = await fetch(FIRESTORE_COMMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.idToken}` },
    body: JSON.stringify({ writes: [{
      currentDocument: { exists: false },
      update: {
        name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/tickets/critical_${flagId}`,
        fields: {
          title: { stringValue: `Critical phrase: ${matchedPhrase.slice(0, 160)}` },
          status: { stringValue: "Open" }, priority: { stringValue: "High" },
          department: { stringValue: "Quality" }, source: { stringValue: "critical_flag" },
          flagId: { stringValue: flagId },
          flagRef: { referenceValue: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/flags/${flagId}` },
          createdById: { stringValue: agentContext.agentId },
          createdByName: { stringValue: agentContext.agentName },
          description: { stringValue: "Review the linked critical flag and coach the agent." },
        },
      },
      updateTransforms: ["createdAt", "updatedAt"].map((fieldPath) => ({ fieldPath, setToServerValue: "REQUEST_TIME" })),
    }] }),
  });
  if (!response.ok) {
    const data = await response.json();
    if (data.error?.status !== "ALREADY_EXISTS") throw new Error(`Ticket write failed: ${response.status}`);
  }
}

async function checkCritical(transcript, bannedPhrases, kbArticles, agentContext, sender) {
  const criticalPhrases = bannedPhrases.filter((phrase) => phrase.severity === "critical");
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
    transcriptSnippet
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
        : `Critical policy alert: "${matchedPhrase}" conflicts with the live knowledge base.`
    });
  }
  await createCriticalTicket(flagId, agentContext, matchedPhrase);
}

async function logSoftSkill(transcript, bannedPhrases, agentContext) {
  const softSkillPhrases = bannedPhrases.filter((phrase) => phrase.severity === "soft_skill");
  const match = findPhraseMatch(transcript, softSkillPhrases);

  if (!match) return;

  await writeFlag({
    ...agentContext,
    type: "soft_skill",
    matchedPhrase: match.wrongPhrase,
    kbArticleId: null,
    transcriptSnippet: extractSnippet(transcript, match.wrongPhrase)
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("CSR Support Extension installed and ready.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_TRANSCRIPT") {
    const transcript = String(request.payload || "").trim();

    if (!transcript) {
      sendResponse({ status: "ignored" });
      return true;
    }

    Promise.all([getBannedPhrases(), getKbArticles(), getAgentContext()])
      .then(([bannedPhrases, kbArticles, agentContext]) =>
        Promise.all([
          checkCritical(transcript, bannedPhrases, kbArticles, agentContext, sender),
          logSoftSkill(transcript, bannedPhrases, agentContext)
        ])
      )
      .then(() => sendResponse({ status: "complete" }))
      .catch((error) => {
        console.error("Error checking transcript:", error);
        sendResponse({ status: "error", message: error.message });
      });
  }

  return true;
});
