// ─── Background Service Worker ───

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "badge_alert" && sender.tab) {
    // Set badge text to red "!" for the tab that sent the message
    chrome.action.setBadgeText({
      text: "!",
      tabId: sender.tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: "#FF3B30",
      tabId: sender.tab.id
    });
  }
});
