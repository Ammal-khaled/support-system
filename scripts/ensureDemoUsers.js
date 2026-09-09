const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("../serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();
const db = getFirestore();

const demoPassword = process.env.AQUADESK_DEMO_PASSWORD;
const shouldResetExistingPasswords = process.env.AQUADESK_RESET_DEMO_PASSWORDS === "true";

const users = [
  {
    email: "lead@aquadesk.local",
    name: "Aquacool Team Lead",
    role: "team_lead",
  },
  {
    email: "agent@aquadesk.local",
    name: "Aquacool Agent",
    role: "agent",
  },
];

async function ensureUser(user) {
  let authUser;

  try {
    authUser = await auth.getUserByEmail(user.email);
    const updates = {
      displayName: user.name,
      disabled: false,
    };

    if (shouldResetExistingPasswords) {
      updates.password = demoPassword;
    }

    await auth.updateUser(authUser.uid, updates);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;

    authUser = await auth.createUser({
      email: user.email,
      password: demoPassword,
      displayName: user.name,
      disabled: false,
    });
  }

  await db.collection("users").doc(authUser.uid).set(
    {
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { email: user.email, role: user.role };
}

async function ensureDemoUsers() {
  if (!demoPassword) {
    throw new Error(
      "Set AQUADESK_DEMO_PASSWORD before creating demo users. This script no longer stores a shared demo password."
    );
  }

  console.log("Creating AquaDesk demo users...");
  if (!shouldResetExistingPasswords) {
    console.log("Existing user passwords will not be changed. Set AQUADESK_RESET_DEMO_PASSWORDS=true to rotate them.");
  }

  for (const user of users) {
    const result = await ensureUser(user);
    console.log(`Ready: ${result.email} (${result.role})`);
  }

  console.log("Done. Demo password came from AQUADESK_DEMO_PASSWORD.");
}

ensureDemoUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo user setup failed:", error);
    process.exit(1);
  });
