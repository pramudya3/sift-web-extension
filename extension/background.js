// Toolbar click opens the side panel (no popup on purpose — one UI surface for MVP).
const openOnActionClick = () =>
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(openOnActionClick);
chrome.runtime.onStartup.addListener(openOnActionClick);
openOnActionClick();
