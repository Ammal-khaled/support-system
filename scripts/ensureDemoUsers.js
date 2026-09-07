const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("../serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();
const db = getFirestore();

const users = [
  {
    email: "lead@aquadesk.local",
    password: "AquaDesk@2026!",
    name: "Aquacool Team Lead",
    role: "team_lead",
  },
  {
    email: "agent@aquadesk.local",
    password: "AquaDesk@2026!",
    name: "Aquacool Agent",
    role: "agent",
  },
];

async function ensureUser(user) {
  let authUser;

  try {
    authUser = await auth.getUserByEmail(user.email);
    await auth.updateUser(authUser.uid, {
      password: user.password,
      displayName: user.name,
      disabled: false,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;

    authUser = await auth.createUser({
      email: user.email,
      password: user.password,
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
  console.log("Creating AquaDesk demo users...");

  for (const user of users) {
    const result = await ensureUser(user);
    console.log(`Ready: ${result.email} (${result.role})`);
  }

  console.log("Done. Password for both users: AquaDesk@2026!");
}

ensureDemoUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo user setup failed:", error);
    process.exit(1);
  });
