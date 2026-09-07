const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const serviceAccount = require("../serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

function atDaysAgo(days, hours = 10) {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return Timestamp.fromDate(date);
}

async function seedAgentData(agent) {
  const agentName = agent.name || agent.email || "Demo Agent";
  const base = `demo_${agent.id}`;

  await db.collection("agent_actions").doc(`${base}_action_1`).set({
    agentId: agent.id,
    agentName,
    actionType: "Clearance",
    source: "demo_seed",
    timestamp: atDaysAgo(1, 9),
  });
  await db.collection("agent_actions").doc(`${base}_action_2`).set({
    agentId: agent.id,
    agentName,
    actionType: "Refund",
    source: "demo_seed",
    timestamp: atDaysAgo(3, 11),
  });
  await db.collection("agent_actions").doc(`${base}_action_3`).set({
    agentId: agent.id,
    agentName,
    actionType: "Move In",
    source: "demo_seed",
    timestamp: atDaysAgo(6, 14),
  });

  await db.collection("flags").doc(`${base}_critical_flag`).set({
    agentId: agent.id,
    agentName,
    type: "critical",
    matchedPhrase: "guaranteed refund",
    transcriptSnippet: "The customer was told they are guaranteed a refund.",
    feedback: "Use the approved refund eligibility wording.",
    reviewed: false,
    source: "demo_seed",
    timestamp: atDaysAgo(1, 9),
  });
  await db.collection("flags").doc(`${base}_soft_skill_flag`).set({
    agentId: agent.id,
    agentName,
    type: "soft_skill",
    matchedPhrase: "I cannot help",
    transcriptSnippet: "The customer heard: I cannot help with that request.",
    feedback: "Practice ownership and offer the next available step.",
    reviewed: false,
    source: "demo_seed",
    timestamp: atDaysAgo(4, 13),
  });

  const ticketRef = db.collection("tickets").doc(`${base}_ticket`);
  await ticketRef.set({
    title: "Demo review: refund wording",
    description: "Demo ticket created to verify the Team Lead ticket overview.",
    department: "Refunds",
    priority: "High",
    status: "Open",
    source: "demo_seed",
    createdById: agent.id,
    createdByName: agentName,
    createdAt: atDaysAgo(1, 9),
    updatedAt: atDaysAgo(1, 9),
  });

  await db.collection("agents_coaching_notes").doc(agent.id).set({
    agentId: agent.id,
    note: "Demo note: review refund wording and ownership language during the next coaching session.",
    updatedBy: "AquaDesk Demo Seed",
    updatedById: "demo_seed",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return agentName;
}

async function seedDemoData() {
  const snapshot = await db.collection("users").where("role", "==", "agent").get();

  if (snapshot.empty) {
    throw new Error("No agent users found. Run npm run users:demo first.");
  }

  const names = [];
  for (const userDoc of snapshot.docs) {
    names.push(await seedAgentData({ id: userDoc.id, ...userDoc.data() }));
  }

  console.log(`Demo activity seeded for ${names.length} agent(s): ${names.join(", ")}`);
  console.log("Created/updated labeled demo actions, flags, ticket records, and coaching notes.");
}

seedDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo data seed failed:", error);
    process.exit(1);
  });
