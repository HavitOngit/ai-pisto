// options.js
// Renders logs per tab in columns.

const refreshBtn = document.getElementById("refresh");
const clearBtn = document.getElementById("clear");
const focusCycleBtn = document.getElementById("focusCycle");
const autoChk = document.getElementById("auto");
const statsEl = document.getElementById("stats");
const columnsWrap = document.getElementById("columns");
const multiInput = document.getElementById("multiInput");
const sendAllBtn = document.getElementById("sendAll"); // now located in footer
const helpBtn = document.getElementById("helpBtn");
const helpDialog = document.getElementById("helpDialog");
const closeHelp = document.getElementById("closeHelp");
let autoTimer = null;
let port = null;
let previousTabIds = new Set();
let lastRenderCounts = {}; // track per tab entry count for update flashes
let currentTabLogs = {}; // snapshot of latest logs keyed by tabId (string keys)
let optionTabId = null; // store the tab id of the options page for reliable refocus

// Discover and cache the options page tab id
function cacheOptionTabId() {
  try {
    chrome.tabs.query({}, (tabs) => {
      const optUrl = chrome.runtime.getURL("options.html");
      const match =
        tabs.find((t) => t.url === optUrl) ||
        tabs.find((t) => t.title === document.title);
      if (match) optionTabId = match.id;
    });
  } catch (_) {
    /* ignore */
  }
}
cacheOptionTabId();
window.addEventListener("focus", cacheOptionTabId);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function render(tabLogs) {
  currentTabLogs = tabLogs || {};
  // Determine if user currently at right edge BEFORE we wipe content
  const nearRightThreshold = 24; // px
  const userAtEnd =
    columnsWrap.scrollLeft + columnsWrap.clientWidth >=
    columnsWrap.scrollWidth - nearRightThreshold;

  const tabIds = Object.keys(tabLogs).sort((a, b) => Number(a) - Number(b));
  const newTabAdded = tabIds.some((id) => !previousTabIds.has(id));

  columnsWrap.innerHTML = "";
  statsEl.textContent = `${tabIds.length} tab(s) | ${tabIds.reduce(
    (acc, id) => acc + tabLogs[id].entries.length,
    0
  )} total entries`;

  tabIds.forEach((id) => {
    const t = tabLogs[id];
    const col = el("div", "tab-col");
    const header = el("header");
    const title = el("span", "title", t.title || "Untitled");
    const url = el(
      "span",
      "url",
      (t.url || "").replace(/^https?:\/\//, "").slice(0, 80)
    );
    const count = el("span", "count", `(${t.entries.length})`);
    header.appendChild(title);
    header.appendChild(count);
    header.appendChild(url);
    col.appendChild(header);
    const pre = el("pre", "log-output");
    pre.textContent = t.entries.join("\n\n");
    col.appendChild(pre);
    const footer = el("footer");
    const copyBtn = el("button", "pill-btn", "Copy");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(t.entries.join("\n\n"));
    });
    const removeBtn = el("button", "pill-btn", "Remove");
    removeBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage(
        { type: "removeTabLogs", tabId: Number(id) },
        fetchLogs
      );
    });
    const focusBtn = el("button", "pill-btn", "Focus");
    focusBtn.addEventListener("click", () => {
      const targetId = Number(id);
      // Focus selected tab briefly, then return to options page.
      chrome.tabs.update(targetId, { active: true }, () => {
        // double-guarantee returning focus (race-safe)
        [220, 600].forEach((ms) => {
          setTimeout(() => {
            if (optionTabId != null)
              chrome.tabs.update(optionTabId, { active: true });
          }, ms);
        });
      });
    });
    footer.appendChild(copyBtn);
    footer.appendChild(removeBtn);
    footer.appendChild(focusBtn);
    col.appendChild(footer);
    // Flash if new entries added (compare previous count)
    const prevCount = lastRenderCounts[id] || 0;
    columnsWrap.appendChild(col);
    if (t.entries.length > prevCount) {
      col.classList.add("flash-update");
      setTimeout(() => col.classList.remove("flash-update"), 900);
    }
    lastRenderCounts[id] = t.entries.length;

    // Auto-scroll vertical only (each column) to bottom for new content
    requestAnimationFrame(() => {
      pre.scrollTop = pre.scrollHeight;
    });
  });

  previousTabIds = new Set(tabIds);

  // Only auto-scroll horizontally if user was at end and a new column appeared
  if (userAtEnd && newTabAdded) {
    requestAnimationFrame(() => {
      columnsWrap.scrollLeft = columnsWrap.scrollWidth;
    });
  }
}

function fetchLogs() {
  chrome.runtime.sendMessage({ type: "getAllLogs" }, (resp) => {
    if (!resp) return;
    render(resp.tabLogs || {});
  });
}

function clearLogs() {
  chrome.runtime.sendMessage({ type: "clearLogs" }, fetchLogs);
}

refreshBtn.addEventListener("click", fetchLogs);
clearBtn.addEventListener("click", clearLogs);
function handleAutoToggle() {
  if (autoChk.checked) {
    if (!port && !autoTimer) autoTimer = setInterval(fetchLogs, 1500);
  } else if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}
autoChk.addEventListener("change", handleAutoToggle);

function initPort() {
  try {
    port = chrome.runtime.connect({ name: "options" });
    port.onMessage.addListener((msg) => {
      if (msg.type === "logsUpdated") {
        fetchLogs();
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      // If user wanted auto, resume polling fallback
      if (autoChk.checked && !autoTimer) {
        autoTimer = setInterval(fetchLogs, 2000);
      }
    });
  } catch (e) {
    // Port might fail in some contexts; fallback to polling if auto enabled
    if (autoChk.checked && !autoTimer) {
      autoTimer = setInterval(fetchLogs, 2000);
    }
  }
}

initPort();
fetchLogs();
// Activate auto refresh default if checked initially
handleAutoToggle();

// Help dialog events
helpBtn?.addEventListener("click", () => {
  if (helpDialog && !helpDialog.open) helpDialog.showModal();
});
closeHelp?.addEventListener("click", () => helpDialog?.close());
helpDialog?.addEventListener("click", (e) => {
  // click outside content closes
  const rect = helpDialog.getBoundingClientRect();
  if (
    e.target === helpDialog &&
    (e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom)
  ) {
    helpDialog.close();
  }
});

// --- Focus Cycle: briefly focus each matching AI tab to coax background rendering ---
focusCycleBtn?.addEventListener("click", () => {
  focusCycleBtn.disabled = true;
  const originalText = focusCycleBtn.textContent;
  focusCycleBtn.textContent = "Cycling...";
  // Only cycle through tabs currently represented in dashboard (currentTabLogs) to avoid unrelated tabs.
  // Convert stored log keys (string) to numbers and verify they still exist & match patterns.
  const livePatterns = [
    /https?:\/\/chatgpt\.com\//,
    /https?:\/\/claude\.ai\//,
    /https?:\/\/grok\.com\//,
    /https?:\/\/gemini\.google\.com\//,
    /https?:\/\/chat\.deepseek\.com\//,
  ];
  chrome.tabs.query({}, (allTabs) => {
    const candidateIds = Object.keys(currentTabLogs).map((k) => Number(k));
    const cycleTabs = allTabs.filter(
      (t) =>
        t.id != null &&
        candidateIds.includes(t.id) &&
        t.url &&
        livePatterns.some((r) => r.test(t.url))
    );
    // Preserve visual order based on sorted candidateIds (same as columns) for predictability
    cycleTabs.sort(
      (a, b) => candidateIds.indexOf(a.id) - candidateIds.indexOf(b.id)
    );
    if (!cycleTabs.length) {
      // Nothing to cycle
      focusCycleBtn.disabled = false;
      focusCycleBtn.textContent = originalText || "Cycle";
      if (optionTabId != null)
        chrome.tabs.update(optionTabId, { active: true });
      return;
    }
    let idx = 0;
    const delayPer = 520; // slightly faster cycle
    function step() {
      if (idx >= cycleTabs.length) {
        // finished: return focus to options reliably with staggered attempts
        [0, 180, 400].forEach((ms) =>
          setTimeout(() => {
            if (optionTabId != null)
              chrome.tabs.update(optionTabId, { active: true });
          }, ms)
        );
        focusCycleBtn.disabled = false;
        focusCycleBtn.textContent = originalText || "Cycle";
        return;
      }
      const tab = cycleTabs[idx++];
      chrome.tabs.update(tab.id, { active: true }, () => {
        setTimeout(step, delayPer);
      });
    }
    step();
  });
});

// Broadcast typed input live (no debounce, but small throttle)
let lastInject = 0;
multiInput?.addEventListener("input", () => {
  // Auto-grow (reset to minimal then expand to content)
  if (multiInput) {
    multiInput.style.height = "auto";
    multiInput.style.height = Math.min(multiInput.scrollHeight, 140) + "px";
  }
  const now = Date.now();
  if (now - lastInject < 120) return; // throttle
  lastInject = now;
  const text = multiInput.value;
  const patterns = [
    "*://chatgpt.com/*",
    "*://claude.ai/*",
    "*://grok.com/*",
    "*://gemini.google.com/*",
    "*://chat.deepseek.com/*",
  ];
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.url) return;
      if (patterns.some((p) => matchPattern(p, tab.url))) {
        chrome.tabs.sendMessage(tab.id, { type: "injectInput", text });
      }
    });
  });
  pulseInputSync();
});

function broadcastSubmit() {
  const text = multiInput.value;
  const patterns = [
    "*://chatgpt.com/*",
    "*://claude.ai/*",
    "*://grok.com/*",
    "*://gemini.google.com/*",
    "*://chat.deepseek.com/*",
  ];
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.url) return;
      if (patterns.some((p) => matchPattern(p, tab.url))) {
        if (text)
          chrome.tabs.sendMessage(tab.id, { type: "injectInput", text });
        chrome.tabs.sendMessage(tab.id, { type: "triggerSubmit" });
      }
    });
  });
  // Clear input after sending
  multiInput.value = "";
  autoGrowReset();
  pulseSend();
}

sendAllBtn?.addEventListener("click", broadcastSubmit);

multiInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    broadcastSubmit();
  }
});

// --- Effects helpers ---
function pulseInputSync() {
  document.querySelectorAll(".tab-col").forEach((col) => {
    col.classList.add("syncing");
    setTimeout(() => col.classList.remove("syncing"), 900);
  });
}
function pulseSend() {
  document.querySelectorAll(".tab-col").forEach((col) => {
    col.classList.add("sending");
    setTimeout(() => col.classList.remove("sending"), 620);
  });
}

function autoGrowReset() {
  if (multiInput) {
    multiInput.style.height = "auto";
  }
}

// Simple matchPattern implementation for subset we use (*://host/*)
function matchPattern(pattern, url) {
  try {
    const u = new URL(url);
    const [schemePart, hostPart] = pattern.split("://");
    const [hostPattern] = hostPart.split("/");
    if (schemePart !== "*") {
      if (u.protocol.replace(":", "") !== schemePart.replace("*", ""))
        return false;
    }
    if (hostPattern !== "*" && hostPattern !== u.host) return false;
    return true;
  } catch {
    return false;
  }
}
