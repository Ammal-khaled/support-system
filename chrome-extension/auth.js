// Firebase web API keys identify a project; authentication comes from the ID token.
const FIREBASE_WEB_API_KEY = "AIzaSyD2ZyVvpHOjnAcJ4g3COPnGtlDApEZWtqM";
let refreshInFlight;

async function getAuthSession() {
  const { authSession } = await chrome.storage.session.get("authSession");
  if (!authSession) throw new Error("Sign in to the AquaDesk extension first.");
  if (authSession.expiresAt > Date.now() + 60000) return authSession;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: authSession.refreshToken }),
      });
      if (!response.ok) throw new Error("Extension session expired. Please sign in again.");
      const data = await response.json();
      const next = { ...authSession, idToken: data.id_token, refreshToken: data.refresh_token,
        uid: data.user_id, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
      const current = await chrome.storage.session.get("authSession");
      if (current.authSession?.refreshToken !== authSession.refreshToken) {
        throw new Error("Extension account changed. Please retry.");
      }
      await chrome.storage.session.set({ authSession: next });
      return next;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
