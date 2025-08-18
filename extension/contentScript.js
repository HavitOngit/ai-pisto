// contentScript.js
// Observes DOM text changes and sends unique logs to background.

let allLogs = []; // keeps full history (unique)
let sessionLogs = new Set(); // keeps unique changes since last prompt
let flushTimeout = null;

function sendBatched() {
  if (sessionLogs.size === 0) return;
  const entries = [...sessionLogs];
  sessionLogs.clear();
  chrome.runtime.sendMessage({ type: "logEntries", entries });
}

function scheduleFlush() {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    sendBatched();
  }, 1000);
}

const responseObserver = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === "characterData") {
      const text = mutation.target.textContent.trim();
      if (text && !allLogs.includes(text)) {
        allLogs.push(text);
        sessionLogs.add(text);
      }
    }
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        let text = "";
        if (node.nodeType === Node.TEXT_NODE) {
          text = node.textContent.trim();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          text = (node.innerText || node.textContent || "").trim();
        }
        if (text && !allLogs.includes(text)) {
          allLogs.push(text);
          sessionLogs.add(text);
        }
      });
    }
  }
  scheduleFlush();
});

responseObserver.observe(document.body, {
  characterData: true,
  subtree: true,
  childList: true,
});

function markPromptSubmitted() {
  sessionLogs.clear();
  console.log("=== Prompt submitted, session reset ===");
}

function dumpSessionLogs() {
  console.log("=== Response since last prompt ===");
  console.log([...sessionLogs].join("\n\n"));
}

function dumpAllLogs() {
  console.log("=== Full conversation so far ===");
  console.log(allLogs.join("\n\n"));
}

const btnObserver = new MutationObserver(() => {
  const btn = document.querySelector('button[type="submit"]');
  if (btn && !btn.dataset.listenerAttached) {
    btn.addEventListener("click", () => {
      markPromptSubmitted();
    });
    btn.dataset.listenerAttached = "true";
    console.log("✅ Submit button found, listener attached");
  }
});

btnObserver.observe(document.body, { childList: true, subtree: true });

// Expose small API for console debugging from the page context
window.__aiLogger = { dumpAllLogs, dumpSessionLogs, markPromptSubmitted };
