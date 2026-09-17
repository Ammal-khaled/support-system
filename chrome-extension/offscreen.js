let recorder = null;
let stream = null;
let chunks = [];

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read recording."));
    reader.readAsDataURL(blob);
  });
}

async function startRecording(streamId) {
  if (recorder?.state === "recording") return { status: "recording" };

  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  recorder.start(1000);
  return { status: "recording" };
}

async function stopRecording() {
  if (!recorder || recorder.state === "inactive") {
    return { status: "empty", audioBase64: "", audioMimeType: "" };
  }

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.stop();
  await stopped;

  stream?.getTracks().forEach((track) => track.stop());
  stream = null;

  const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
  recorder = null;
  chunks = [];

  return {
    status: blob.size ? "ready" : "empty",
    audioBase64: blob.size ? await blobToBase64(blob) : "",
    audioMimeType: blob.type || "audio/webm",
    audioFileName: `maqsam-call-${new Date().toISOString()}.webm`,
  };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "START_TAB_RECORDING") {
    startRecording(request.streamId)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: "error", message: error.message }));
    return true;
  }

  if (request.type === "STOP_TAB_RECORDING") {
    stopRecording()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: "error", message: error.message }));
    return true;
  }

  return false;
});
