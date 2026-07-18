chrome.runtime.onInstalled.addListener(() => {
  console.log("CSR Support Extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_TRANSCRIPT") {
    const transcript = request.payload.toLowerCase();
    console.log("Analyzing transcript:", transcript);

    // Simulated AI Policy Check
    if (transcript.includes("promise") || transcript.includes("guarantee")) {
      console.log("Violation Risk Detected!");
      
      // Fire a warning back to the specific browser tab
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "SHOW_WARNING",
        message: "Policy Alert: Do not guarantee outcomes or promise refunds without Team Lead approval."
      });
    }
    sendResponse({ status: "processed" });
  }
  return true;
});
