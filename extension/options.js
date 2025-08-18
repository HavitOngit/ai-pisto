// options.js
// Renders logs per tab in columns.

const refreshBtn = document.getElementById("refresh");
const clearBtn = document.getElementById("clear");
const autoChk = document.getElementById("auto");
const statsEl = document.getElementById("stats");
const columnsWrap = document.getElementById("columns");
let autoTimer = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function render(tabLogs) {
  columnsWrap.innerHTML = "";
  const tabIds = Object.keys(tabLogs);
  statsEl.textContent = `${tabIds.length} tab(s) | ${tabIds.reduce(
    (acc, id) => acc + tabLogs[id].entries.length,
    0
  )} total entries`;
  tabIds
    .sort((a, b) => Number(a) - Number(b))
    .forEach((id) => {
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
      footer.appendChild(copyBtn);
      footer.appendChild(removeBtn);
      col.appendChild(footer);
      columnsWrap.appendChild(col);

      // Auto-scroll to bottom for new content
      requestAnimationFrame(() => {
        pre.scrollTop = pre.scrollHeight;
      });
    });

  // Auto-scroll horizontally to newest column
  requestAnimationFrame(() => {
    columnsWrap.scrollLeft = columnsWrap.scrollWidth;
  });
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
autoChk.addEventListener("change", () => {
  if (autoChk.checked) {
    autoTimer = setInterval(fetchLogs, 1500);
  } else if (autoTimer) {
    clearInterval(autoTimer);
  }
});

fetchLogs();
