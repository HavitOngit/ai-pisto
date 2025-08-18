# AI Pisto

<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="AI Pisto logo" />
</p>

Unified multi‑tab AI prompt broadcaster & response logger for ChatGPT, Claude, Gemini, Grok, DeepSeek (and easily extensible).

---

## ✨ Features

- Capture streaming AI responses across multiple tabs (MutationObserver + network stream interception).
- Per‑tab columns UI with auto scroll and update flashes.
- Broadcast a prompt simultaneously to all supported AI sites.
- One‑click submit across every tab (Enter to send, Shift+Enter for newline).
- Live sync typing (text mirrors into each site in near real‑time).
- Individual Focus buttons (briefly activate a tab then return) + global Cycle Tabs to force background rendering.
- Lightweight popup to open the dashboard.
- Persistent log storage (per session & across reloads).
- Copy / remove logs per tab.

## 🧩 Supported Sites (default)

| Site     | URL Pattern                  |
| -------- | ---------------------------- |
| ChatGPT  | `https://chatgpt.com/`       |
| Claude   | `https://claude.ai/`         |
| Grok     | `https://grok.com/`          |
| Gemini   | `https://gemini.google.com/` |
| DeepSeek | `https://chat.deepseek.com/` |

(You can add more by extending selector logic in `extension/contentScript.js`.)

## 🚀 Install (Unpacked)

1. Clone / download this repository.
2. Open Chrome (or any Chromium‑based browser) → `chrome://extensions`.
3. Enable Developer Mode (top right).
4. Click “Load unpacked” and select the `extension/` folder inside this project.
5. Pin the “AI Pisto” action icon for quick access.

## 🧪 Usage

1. Open several tabs with supported AI sites.
2. Click the extension icon (popup) → “Open Dashboard” (or open the options page via extension details).
3. Use the floating broadcaster textarea at the bottom:
   - Type to live‑sync across all AI tabs.
   - Press Enter (no Shift) or click Send to broadcast + auto‑submit.
4. Watch each tab’s column fill with responses in real time.
5. If a tab lags (background throttling), click its Focus button or use Cycle Tabs.
   (this will switch all/that tab and back to dashboard automatically)
6. Copy / Remove logs with the footer buttons.
7. Clear all logs with Clear Button.

## 🔍 Forcing Background Rendering

Browsers may delay DOM updates in background tabs. Mitigations included:

- Faster flush cycle for hidden tabs.
- Streaming fetch interception to capture SSE / chunked tokens.
- Manual Focus & Cycle Tabs buttons to briefly activate tabs.

## 🛠 Extend / Customize

Add another provider:

1. Edit `extension/contentScript.js`.
2. In `detectSiteAndSetInput(text)`, add a new URL regex + DOM selector logic for its editor.
3. In `detectAndClickSubmit()`, add selector logic for the submit button.
4. Add its match pattern to broadcast pattern lists in `extension/options.js`.

## 📁 Key Files

| Path                              | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `extension/manifest.json`         | MV3 manifest configuration                |
| `extension/background.js`         | Central log store & message hub           |
| `extension/contentScript.js`      | DOM & streaming capture + injection logic |
| `extension/options.html/.js/.css` | Multi‑tab dashboard UI                    |
| `extension/popup.html`            | Quick launcher popup                      |
| `extension/icons/`                | Branding assets                           |

## 🔐 Permissions Rationale

- `tabs`: Needed to enumerate & activate AI site tabs (focus cycling, broadcast).
- `storage`: Persist captured logs.
- `<all_urls>` host permission (via content script): Required to observe and inject into supported sites; you can narrow this to explicit host patterns if desired.

## 🧪 Development Tips

While editing the extension:

1. After changes, go to `chrome://extensions` and click Reload on AI Pisto.
2. Open DevTools for the options page & any AI tab to view console logs (`window.__aiLogger`).
3. Use the Focus or Cycle buttons if streaming stalls in background.

## 🐞 Troubleshooting

| Symptom                   | Fix                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| No logs appear            | Ensure the AI site loaded after extension install; reload tab.                                  |
| Some responses truncated  | Background throttling – try Focus button or Cycle Tabs.                                         |
| Injection fails on a site | Selector changed – update logic in `detectSiteAndSetInput`.                                     |
| Duplicate fragments       | Site re-renders – de‑dupe via Set; inspect captured raw with `window.__aiLogger.dumpAllLogs()`. |

## 📦 Packaging / Release

A GitHub Actions workflow zips the `extension/` directory and creates/updates a release tag (derives from `manifest.json` version). You can publish that zip to the Chrome Web Store (after adding required listing assets). Firefox compatibility would require minor adjustments (e.g., `browser` polyfill and possibly manifest tweaks).

## 🗺 Roadmap Ideas

- WebSocket interception for providers not using fetch streams.
- Merge incremental token fragments into cleaner paragraphs.
- Toggle to disable animations / reduce motion.
- Firefox build variant.
- Configurable per-tab auto-focus cadence.

## 📣 Attribution / License

MIT License – do what you wish, attribution appreciated. Replace icon if distributing publicly.

---

Enjoy faster multi‑model prompting with AI Pisto.
