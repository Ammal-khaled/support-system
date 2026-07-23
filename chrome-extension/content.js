// Check if the browser supports the Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function showWarningModal(message) {
  if (document.getElementById("csr-warning-box")) return;

  const modal = document.createElement("div");
  modal.id = "csr-warning-box";
  modal.className = "csr-warning-modal";
  modal.innerHTML = `
    <h3 style="color: #dc2626; font-weight: bold; margin-bottom: 8px;">Compliance Alert</h3>
    <p style="color: #374151; font-size: 14px; margin-bottom: 12px;">${message}</p>
    <button id="csr-dismiss-btn" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
      Acknowledge
    </button>
  `;

  document.body.appendChild(modal);

  document.getElementById("csr-dismiss-btn").addEventListener("click", () => {
    modal.remove();
  });
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.type !== "SHOW_WARNING") return;

  if (request.severity === "critical") {
    showWarningModal(request.message);
    return;
  }

  console.log("CSR Support Extension: soft-skill flag logged without interrupting the agent.", request);
});

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();

  // Keep listening continuously
  recognition.continuous = true;
  // We only want the final translated sentences, not the guessing phase
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    let currentText = "";

    // Loop through the results and grab the latest final transcript
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        currentText += event.results[i][0].transcript.trim();
      }
    }

    if (currentText) {
      console.log("CSR Transcript Captured:", currentText);

      // Send the captured text to the background.js file
      chrome.runtime.sendMessage({
        type: "CHECK_TRANSCRIPT",
        payload: currentText
      });
    }
  };

  recognition.onerror = (event) => {
    console.error("CSR Extension Speech Recognition Error:", event.error);
  };

  // Restart automatically if it drops
  recognition.onend = () => {
    try {
      recognition.start();
    } catch (error) {
      console.error("CSR Extension Speech Recognition Restart Error:", error);
    }
  };

  // Start listening immediately when the Maqsam page loads
  try {
    recognition.start();
    console.log("CSR Support Extension: Web Speech API is actively listening to the microphone.");
  } catch (error) {
    console.error("CSR Extension Speech Recognition Start Error:", error);
  }
} else {
  console.error("Speech Recognition is not supported in this browser.");
}
