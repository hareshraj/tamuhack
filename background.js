//background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Minimal background script, mainly for manifest v3 compliance
    return true;
});