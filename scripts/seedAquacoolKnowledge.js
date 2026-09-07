const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("../serviceAccountKey.json");
const workflows = require("../src/data/aquacoolKnowledge.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seedAquacoolKnowledge() {
  console.log(`Publishing ${workflows.length} Aquacool knowledge workflows...`);

  let created = 0;
  let skipped = 0;

  for (const workflow of workflows) {
    const existing = await db
      .collection("knowledge_base")
      .where("sourceId", "==", workflow.id)
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped += 1;
      continue;
    }

    await db.collection("knowledge_base").add({
      title: workflow.title,
      content: workflow.summary,
      category: workflow.category,
      priority: workflow.priority,
      sourceId: workflow.id,
      customerQuestions: workflow.customerQuestions,
      agentSteps: workflow.agentSteps,
      sourceFiles: workflow.sourceFiles,
      keywords: workflow.keywords,
      asset: workflow.asset || "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    created += 1;
  }

  console.log(`Done. Created: ${created}. Skipped existing: ${skipped}.`);
}

seedAquacoolKnowledge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Aquacool knowledge seed failed:", error);
    process.exit(1);
  });
