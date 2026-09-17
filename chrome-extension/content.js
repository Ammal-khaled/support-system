const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecognitionRunning = false;
let lastCaptionText = "";
let lastCallActiveState = null;

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
}

function showWarningModal(message, knowledgeBaseUrl) {
  if (document.getElementById("csr-warning-box")) return;

  const modal = document.createElement("div");
  modal.id = "csr-warning-box";
  modal.className = "csr-warning-modal";
  modal.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 14px;">
      <div style="display: flex; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 14px; background: #fee2e2; color: #dc2626; font-size: 22px; font-weight: 900;">!</div>
      <div style="min-width: 0; flex: 1;">
        <p style="margin: 0 0 4px; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;">Live call guidance</p>
        <h3 style="color: #0f172a; font-size: 20px; line-height: 1.2; font-weight: 800; margin: 0 0 10px;">Correct this answer before continuing</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.55; margin: 0 0 16px;">${escapeHtml(message)}</p>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          ${knowledgeBaseUrl ? `<a href="${escapeHtml(knowledgeBaseUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border-radius: 12px; background: #0089bf; color: white; padding: 0 14px; text-decoration: none; font-size: 13px; font-weight: 800;">Open correct knowledge card</a>` : ""}
          <button id="csr-dismiss-btn" style="min-height: 40px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; color: #475569; padding: 0 14px; cursor: pointer; font-size: 13px; font-weight: 800;">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  `;

  modal.style.cssText = [
    "position: fixed",
    "right: 24px",
    "top: 24px",
    "z-index: 2147483647",
    "width: min(420px, calc(100vw - 48px))",
    "box-sizing: border-box",
    "border: 1px solid #fecaca",
    "border-left: 6px solid #ef4444",
    "border-radius: 20px",
    "background: rgba(255,255,255,.98)",
    "box-shadow: 0 24px 70px rgba(15,23,42,.28)",
    "padding: 18px",
    "font-family: Inter, Arial, sans-serif",
  ].join(";");

  document.body.appendChild(modal);

  document.getElementById("csr-dismiss-btn").addEventListener("click", () => {
    modal.remove();
  });
}

function cleanTranscriptText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 50000);
}

function extractMaqsamTranscriptFromPage() {
  const transcriptSelectors = [
    "[data-testid*='transcript' i]",
    "[aria-label*='transcript' i]",
    "[class*='transcript' i]",
    "[id*='transcript' i]",
    "[class*='conversation' i]",
    "[class*='caption' i]",
  ];
  const candidates = transcriptSelectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .map((node) => cleanTranscriptText(node.textContent))
    .filter((text) => text.length > 80)
    .sort((a, b) => b.length - a.length);

  if (candidates[0]) return candidates[0];

  const speakerLinePattern = /\b(agent|customer|client|caller|representative|support)\b\s*[:\-]/i;
  const timeLinePattern = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
  const pageLines = cleanTranscriptText(document.body?.innerText || "")
    .split("\n")
    .filter((line) => speakerLinePattern.test(line) || timeLinePattern.test(line));

  return cleanTranscriptText(pageLines.join("\n"));
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "EXTRACT_MAQSAM_TRANSCRIPT") {
    const transcript = extractMaqsamTranscriptFromPage();
    sendResponse({
      status: transcript ? "ready" : "missing",
      transcript,
      characters: transcript.length,
    });
    return true;
  }

  if (request.type !== "SHOW_WARNING") return false;

  if (request.severity === "critical") {
    showWarningModal(request.message, request.knowledgeBaseUrl);
    return false;
  }

  console.log("CSR Support Extension: soft-skill flag logged without interrupting the agent.", request);
  return false;
});

function startRecognition() {
  if (!SpeechRecognition) {
    console.error("Speech Recognition is not supported in this browser.");
    return;
  }

  if (isRecognitionRunning) return;

  recognition = new SpeechRecognition();

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

      chrome.runtime.sendMessage({
        type: "CHECK_TRANSCRIPT",
        payload: currentText,
        speaker: "agent",
        source: "agent_live_capture",
      });
    }
  };

  recognition.onerror = (event) => {
    console.error("CSR Extension Speech Recognition Error:", event.error);
    isRecognitionRunning = false;
  };

  // Restart automatically if it drops
  recognition.onend = () => {
    isRecognitionRunning = false;

    try {
      recognition.start();
      isRecognitionRunning = true;
    } catch (error) {
      console.error("CSR Extension Speech Recognition Restart Error:", error);
    }
  };

  // Start listening immediately when the Maqsam page loads
  try {
    recognition.start();
    isRecognitionRunning = true;
    console.log("CSR Support Extension: Web Speech API is actively listening to the microphone.");
  } catch (error) {
    isRecognitionRunning = false;
    console.error("CSR Extension Speech Recognition Start Error:", error);
  }
}

async function sendCaptionText(text) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText || normalizedText === lastCaptionText) return;

  lastCaptionText = normalizedText;
  chrome.runtime.sendMessage({
    type: "CHECK_TRANSCRIPT",
    payload: normalizedText,
    source: "maqsam_live_caption",
  });
}

function startCaptionObserver() {
  const readCaptions = () => {
    document.querySelectorAll(".live-caption-text").forEach((captionNode) => {
      sendCaptionText(captionNode.textContent);
    });
  };

  readCaptions();

  const observer = new MutationObserver(readCaptions);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function detectCallActive() {
  if (!location.hostname.includes("maqsam.com") || !location.pathname.startsWith("/phone/dialer")) return null;
  const buttons = Array.from(document.querySelectorAll("button, [role='button'], a"));
  const hasHangupControl = buttons.some((node) => {
    const text = String(node.innerText || node.getAttribute("aria-label") || node.title || "").toLowerCase();
    return /\b(end|hang\s*up|hangup|disconnect|finish|terminate|drop)\b/.test(text) && /\b(call|dial|conversation)?\b/.test(text);
  });
  const pageText = String(document.body?.innerText || "").toLowerCase();
  const endedSignal = /\b(call ended|call finished|conversation ended|wrap up|after call|call completed|disconnected|ended)\b/.test(pageText);
  const liveSignal = /\b(live call|in call|ongoing call|connected|ringing|dialing|on call|mute|hold|keypad)\b/.test(pageText);

  if (hasHangupControl || (liveSignal && !endedSignal)) return true;
  if (endedSignal) return false;
  return null;
}

function publishCallState() {
  const active = detectCallActive();
  if (active === null || active === lastCallActiveState) return;
  lastCallActiveState = active;
  chrome.runtime.sendMessage({
    type: "MAQSAM_CALL_STATE",
    active,
    source: "maqsam_dialer_dom",
  });
}

function startCallStateObserver() {
  if (!location.hostname.includes("maqsam.com") || !location.pathname.startsWith("/phone/dialer")) return;
  publishCallState();
  const observer = new MutationObserver(publishCallState);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "class"],
  });
  window.setInterval(publishCallState, 3000);
}

startCaptionObserver();
startCallStateObserver();
startRecognition();
