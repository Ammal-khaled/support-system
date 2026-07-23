const FIREBASE_PROJECT_ID = "csr-support-system";
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
    const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}`);
    const data = await response.json();

    if (!data.documents) return [];

    return data.documents.map((document) => ({
      id: document.name.split("/").pop(),
      fields: document.fields || {}
    }));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
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

function getAgentContext(request) {
  return {
    agentId: request.agentId || "unknown_agent",
    agentName: request.agentName || "Unknown Agent"
  };
}

async function writeFlag({ agentId, agentName, type, matchedPhrase, kbArticleId, transcriptSnippet }) {
  const documentId = generateFirestoreId();

  await fetch(FIRESTORE_COMMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
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
}

async function checkCritical(transcript, bannedPhrases, kbArticles, agentContext, sender) {
  const criticalPhrases = bannedPhrases.filter((phrase) => phrase.severity === "critical");
  const phraseMatch = findPhraseMatch(transcript, criticalPhrases);
  const kbMismatch = findKbFactMismatch(transcript, kbArticles);
  const match = phraseMatch || kbMismatch;

  if (!match) return;

  const matchedPhrase = match.wrongPhrase;
  const transcriptSnippet = extractSnippet(transcript, matchedPhrase);

  await writeFlag({
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
      message: match.correctPhrase
        ? `Critical policy alert: replace "${matchedPhrase}" with "${match.correctPhrase}".`
        : `Critical policy alert: "${matchedPhrase}" conflicts with the live knowledge base.`
    });
  }
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

    const agentContext = getAgentContext(request);

    Promise.all([getBannedPhrases(), getKbArticles()])
      .then(([bannedPhrases, kbArticles]) =>
        Promise.all([
          checkCritical(transcript, bannedPhrases, kbArticles, agentContext, sender),
          logSoftSkill(transcript, bannedPhrases, agentContext)
        ])
      )
      .catch((error) => {
        console.error("Error checking transcript:", error);
      });

    sendResponse({ status: "processing" });
  }

  return true;
});
