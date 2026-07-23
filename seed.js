const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seed() {
  console.log("Seeding knowledge_base...");
  const kbArticles = [
    {
      title: "Refund Policy",
      content:
        "Standard refunds are processed within 5 business days. Customer must provide order number and reason for refund.",
      category: "billing",
    },
    {
      title: "Clearance Process",
      content:
        "Clearance requests take 1 to 3 working days. Agent must verify customer ID and submit form CL-01 to the clearance team.",
      category: "clearance",
    },
    {
      title: "Password Reset",
      content:
        "Verify customer identity via email and phone before resetting. Reset link is valid for 24 hours.",
      category: "account",
    },
    {
      title: "Account Cancellation",
      content:
        "Offer retention discount before processing cancellation. Cancellation takes effect at the end of the current billing cycle.",
      category: "billing",
    },
  ];
  for (const article of kbArticles) {
    await db
      .collection("knowledge_base")
      .add({ ...article, createdAt: FieldValue.serverTimestamp() });
  }

  console.log("Seeding banned_phrases...");
  const bannedPhrases = [
    {
      wrongPhrase: "i can't help you",
      correctPhrase: "Let me find someone who can assist you with that.",
      severity: "critical",
      category: "escalation",
    },
    {
      wrongPhrase: "promise",
      correctPhrase: "We'll do everything we can to resolve this for you.",
      severity: "critical",
      category: "commitment_language",
    },
    {
      wrongPhrase: "guarantee",
      correctPhrase: "We'll do everything we can to resolve this for you.",
      severity: "critical",
      category: "commitment_language",
    },
    {
      wrongPhrase: "yeah",
      correctPhrase: "Yes, of course.",
      severity: "soft_skill",
      category: "professionalism",
    },
    {
      wrongPhrase: "i don't know",
      correctPhrase: "Let me check on that for you.",
      severity: "soft_skill",
      category: "confidence",
    },
  ];
  for (const phrase of bannedPhrases) {
    await db.collection("banned_phrases").add(phrase);
  }

  console.log("Seeding action_types...");
  const actionTypes = ["Clearance", "Refund", "Bells", "Account Verification"];
  for (const name of actionTypes) {
    await db.collection("action_types").add({ name });
  }

  console.log("Seeding dummy flags...");
  const dummyFlags = [
    {
      agentId: "demo-agent-1",
      agentName: "Nicole (Demo)",
      type: "critical",
      matchedPhrase: "i can't help you",
      kbArticleId: null,
      transcriptSnippet: "I'm sorry, I can't help you with that right now.",
      reviewed: false,
    },
    {
      agentId: "demo-agent-2",
      agentName: "Omar (Demo)",
      type: "soft_skill",
      matchedPhrase: "yeah",
      kbArticleId: null,
      transcriptSnippet: "Yeah, that should be fine.",
      reviewed: false,
    },
  ];
  for (const flag of dummyFlags) {
    await db
      .collection("flags")
      .add({ ...flag, timestamp: FieldValue.serverTimestamp() });
  }

  console.log("Seeding dummy agent_actions...");
  const dummyActions = [
    {
      agentId: "demo-agent-1",
      agentName: "Nicole (Demo)",
      actionType: "Clearance",
    },
    { agentId: "demo-agent-2", agentName: "Omar (Demo)", actionType: "Refund" },
  ];
  for (const action of dummyActions) {
    await db
      .collection("agent_actions")
      .add({ ...action, timestamp: FieldValue.serverTimestamp() });
  }

  console.log("Done! All collections seeded with dummy data.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
