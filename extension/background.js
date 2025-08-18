// background.js
// Maintains central log store per tab and handles messages between content scripts and options page.

// Structure: { [tabId]: { url, title, entries: [] } }
let tabLogs = {};

// Connected option page ports for push updates
const optionPorts = new Set();

function broadcastUpdate(tabId) {
  optionPorts.forEach((port) => {
    try {
      port.postMessage({ type: "logsUpdated", tabId });
    } catch (e) {
      optionPorts.delete(port);
    }
  });
}

function loadLogs() {
  chrome.storage.local.get({ tabLogs: {} }, (res) => {
    if (res && typeof res.tabLogs === "object") {
      tabLogs = res.tabLogs;
    }
  });
}

function persist() {
  chrome.storage.local.set({ tabLogs });
}

loadLogs();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "logEntries") {
    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "no-tab-id" });
      return;
    }
    const tabInfo = tabLogs[tabId] || {
      url: sender.tab.url,
      title: sender.tab.title,
      entries: [],
    };
    let added = 0;
    for (const entry of msg.entries) {
      if (!tabInfo.entries.includes(entry)) {
        tabInfo.entries.push(entry);
        added++;
      }
    }
    tabLogs[tabId] = tabInfo;
    if (added) {
      persist();
      broadcastUpdate(tabId);
    }
    sendResponse({ ok: true, total: tabInfo.entries.length, tabId });
    return;
  }
  if (msg.type === "getAllLogs") {
    sendResponse({ tabLogs });
    return;
  }
  if (msg.type === "clearLogs") {
    tabLogs = {};
    persist();
    broadcastUpdate("all");
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === "removeTabLogs") {
    if (msg.tabId != null) {
      delete tabLogs[msg.tabId];
      persist();
      broadcastUpdate("all");
    }
    sendResponse({ ok: true });
    return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Optionally keep logs even after tab closes; if you want auto clean, uncomment:
  // delete tabLogs[tabId];
  // persist();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Response Logger installed.");
});

chrome.runtime.onStartup?.addListener(() => loadLogs());

// Long-lived connection for options page
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "options") {
    optionPorts.add(port);
    port.onDisconnect.addListener(() => optionPorts.delete(port));
    port.postMessage({ type: "logsUpdated", tabId: "all" });
  }
});
