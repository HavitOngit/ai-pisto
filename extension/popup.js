document.getElementById("openOptions").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});

// Allow pressing Enter to open quickly when button focused.
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    document.activeElement === document.getElementById("openOptions")
  ) {
    document.getElementById("openOptions").click();
  }
});
