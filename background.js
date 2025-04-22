// background.js - Handles extension background operations

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({
    enabled: false,
    cursorSize: 'medium', // small, medium, large
    readingSpeed: 'normal', // slow, normal, fast
    highlightColor: '#4285F4', // Google Blue
    volume: 0.8 // 0.0 to 1.0
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSettings") {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse({ settings });
    });
    return true; // Required for async response
  }
  
  if (message.action === "readText") {
    // Forward the text to the content script to be read
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "readText",
          text: message.text,
          settings: message.settings
        });
      }
    });
  }
});