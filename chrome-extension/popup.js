const form = document.getElementById("login");
const statusText = document.getElementById("status");
const logout = document.getElementById("logout");
const callTools = document.getElementById("call-tools");
const callStatus = document.getElementById("call-status");
const endCall = document.getElementById("end-call");
const FIRESTORE_USER_URL = "https://firestore.googleapis.com/v1/projects/csr-support-system/databases/(default)/documents/users";

function refreshCallStatus() {
  chrome.runtime.sendMessage({ type: "GET_CALL_STATUS" }, (response) => {
    if (chrome.runtime.lastError) return;
    callStatus.textContent = response?.status === "ready"
      ? `${response.characters.toLocaleString()} transcript characters captured.`
      : "No transcript captured yet.";
  });
}

async function renderSession() {
  const { authSession } = await chrome.storage.session.get("authSession");
  form.hidden = Boolean(authSession);
  logout.hidden = !authSession;
  callTools.hidden = !authSession;
  statusText.textContent = authSession ? `Signed in as ${authSession.name}` : "Sign in with your AquaDesk account.";
  if (authSession) refreshCallStatus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("submit");
  button.disabled = true;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value, returnSecureToken: true }),
    });
    if (!response.ok) throw new Error("Sign-in failed. Check your email and password.");
    const data = await response.json();
    const profileResponse = await fetch(`${FIRESTORE_USER_URL}/${data.localId}?access_token=${encodeURIComponent(data.idToken)}`);
    if (!profileResponse.ok) throw new Error("Your AquaDesk profile could not be loaded.");
    const profile = await profileResponse.json();
    const role = profile.fields?.role?.stringValue || "";
    const disabled = profile.fields?.disabled?.booleanValue === true || role === "disabled";
    if (disabled) throw new Error("This AquaDesk account is deactivated. Contact your team lead.");
    await chrome.storage.session.set({ authSession: { uid: data.localId,
      name: profile.fields?.displayName?.stringValue || data.displayName || data.email, role,
      idToken: data.idToken, refreshToken: data.refreshToken,
      expiresAt: Date.now() + Number(data.expiresIn) * 1000 } });
    await renderSession();
  } catch (error) { statusText.textContent = error.message; }
  finally { document.getElementById("password").value = ""; button.disabled = false; }
});
logout.addEventListener("click", async () => {
  await chrome.storage.session.remove("authSession");
  await renderSession();
});

endCall.addEventListener("click", () => {
  endCall.disabled = true;
  callStatus.textContent = "Sending the complete transcript for analysis...";
  chrome.runtime.sendMessage({ type: "END_CALL_ANALYSIS" }, (response) => {
    endCall.disabled = false;
    if (chrome.runtime.lastError || response?.status === "error") {
      callStatus.textContent = response?.message || "Unable to complete the after-call analysis.";
      return;
    }
    callStatus.textContent = "After-call report saved for Team Lead and Quality.";
  });
});
renderSession();
