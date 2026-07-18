// Service Worker for the Chrome Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("CSR Support Extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_TRANSCRIPT") {
    console.log("Received transcript snippet:", request.payload);
    // TODO: Send to Firebase function for AI validation
    sendResponse({ status: "processing" });
  }
  return true;
});
