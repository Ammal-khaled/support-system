console.log("CSR Support Content Script loaded. Listening for captions...");

let lastCaption = "";

// Set up the MutationObserver to watch the DOM for new text
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // We target a specific class that our mock-up or live captions will use
    if (mutation.target.className && typeof mutation.target.className === 'string' && mutation.target.className.includes('live-caption-text')) {
      const newText = mutation.target.innerText.trim();
      
      // Only send if the text actually changed to prevent spamming the database
      if (newText && newText !== lastCaption) {
        lastCaption = newText;
        console.log("Captured speech:", newText);
        
        // Route the text to the background script for AI processing
        chrome.runtime.sendMessage({
          type: "CHECK_TRANSCRIPT",
          payload: newText
        });
      }
    }
  });
});

// Start watching the entire body of the webpage
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Listen for AI warnings from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SHOW_WARNING") {
    showWarningModal(request.message);
  }
});

// Function to inject the UI alert
function showWarningModal(message) {
  // Prevent duplicate modals if the agent keeps talking
  if (document.getElementById("csr-warning-box")) return;

  const modal = document.createElement("div");
  modal.id = "csr-warning-box";
  modal.className = "csr-warning-modal"; // Uses our styles.css
  modal.innerHTML = `
    <h3 style="color: #dc2626; font-weight: bold; margin-bottom: 8px;">⚠️ Compliance Alert</h3>
    <p style="color: #374151; font-size: 14px; margin-bottom: 12px;">${message}</p>
    <button id="csr-dismiss-btn" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
      Acknowledge
    </button>
  `;

  document.body.appendChild(modal);

  // Remove the modal when the agent clicks acknowledge
  document.getElementById("csr-dismiss-btn").addEventListener("click", () => {
    modal.remove();
  });
}
