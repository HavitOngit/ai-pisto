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

// ==== Remote Input Binding Support ====
// The options page will send {type: 'injectInput', text: '...'} to all tabs.
// We try different site-specific strategies to put the text into the active editor.

function detectSiteAndSetInput(text) {
  const loc = location.href;
  try {
    if (
      /^https:\/\/chatgpt\.com\//.test(loc) ||
      /^https:\/\/claude\.ai\//.test(loc)
    ) {
      // ProseMirror editable
      const editor = document.querySelector(".ProseMirror");
      if (editor) {
        // Clear children
        while (editor.firstChild) editor.removeChild(editor.firstChild);
        const p = document.createElement("p");
        p.textContent = text;
        editor.appendChild(p);
        // Input events for frameworks
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
    }
    if (/^https:\/\/grok\.com\//.test(loc)) {
      const field = document.querySelector('[aria-label="Ask Grok anything"]');
      if (field) {
        field.value = text;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
    }
    if (/^https:\/\/gemini\.google\.com\//.test(loc)) {
      const editor = document.querySelector(
        '[aria-label="Enter a prompt here"]'
      );
      if (editor) {
        while (editor.firstChild) editor.removeChild(editor.firstChild);
        const p = document.createElement("p");
        p.textContent = text;
        editor.appendChild(p);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
    }
    if (/^https:\/\/chat\.deepseek\.com\//.test(loc)) {
      const area = document.getElementById("chat-input");
      if (area) {
        area.value = text;
        area.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
    }
  } catch (e) {
    console.warn("Inject input failed", e);
  }
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "injectInput") {
    const ok = detectSiteAndSetInput(msg.text || "");
    sendResponse?.({ ok });
    return; // synchronous
  }
  if (msg && msg.type === "triggerSubmit") {
    const clicked = detectAndClickSubmit();
    sendResponse?.({ ok: clicked });
    return;
  }
});

// ---- Submit button detection & click ----
function detectAndClickSubmit() {
  const loc = location.href;
  let btn = null;
  try {
    if (/^https:\/\/chatgpt\.com\//.test(loc)) {
      btn = document.getElementById("composer-submit-button");
    } else if (/^https:\/\/grok\.com\//.test(loc)) {
      btn = document.querySelector('[aria-label="Submit"]');
    } else if (/^https:\/\/(gemini\.google\.com|claude\.ai)\//.test(loc)) {
      btn = document.querySelector('[aria-label="Send message"]');
    } else if (/^https:\/\/chat\.deepseek\.com\//.test(loc)) {
      const buttons = document.querySelectorAll('[role="button"]');
      if (buttons.length) btn = buttons[buttons.length - 1];
    }
    if (btn) {
      btn.click();
      return true;
    }
  } catch (e) {
    console.warn("Submit trigger failed", e);
  }
  return false;
}
