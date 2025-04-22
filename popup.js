// popup.js - Handles popup interface functionality

document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const enableToggle = document.getElementById('enableToggle');
  const cursorSize = document.getElementById('cursorSize');
  const readingSpeed = document.getElementById('readingSpeed');
  const volume = document.getElementById('volume');
  const highlightColor = document.getElementById('highlightColor');
  const status = document.getElementById('status');
  
  // Load settings
  chrome.storage.sync.get(null, (settings) => {
    // Update UI to match settings
    enableToggle.checked = settings.enabled;
    cursorSize.value = settings.cursorSize;
    readingSpeed.value = settings.readingSpeed;
    volume.value = settings.volume;
    highlightColor.value = settings.highlightColor;
    
    // Update status message
    updateStatus(settings.enabled);
  });
  
  // Check if speech is currently happening
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getStatus"}, (response) => {
        if (response && response.speaking) {
          status.textContent = "Currently reading text...";
        }
      });
    }
  });
  
  // Handle enable toggle
  enableToggle.addEventListener('change', function() {
    const isEnabled = this.checked;
    
    // Save settings
    chrome.storage.sync.set({enabled: isEnabled}, () => {
      updateStatus(isEnabled);
    });
  });
  
  // Handle cursor size change
  cursorSize.addEventListener('change', function() {
    chrome.storage.sync.set({cursorSize: this.value});
  });
  
  // Handle reading speed change
  readingSpeed.addEventListener('change', function() {
    chrome.storage.sync.set({readingSpeed: this.value});
  });
  
  // Handle volume change
  volume.addEventListener('input', function() {
    chrome.storage.sync.set({volume: parseFloat(this.value)});
  });
  
  // Handle highlight color change
  highlightColor.addEventListener('input', function() {
    chrome.storage.sync.set({highlightColor: this.value});
  });
  
  // Update status text
  function updateStatus(isEnabled) {
    if (isEnabled) {
      status.textContent = "Active: Hover over elements to highlight, click to read, double-click to activate";
    } else {
      status.textContent = "Disabled: Enable the toggle to start using Whisper Web";
    }
  }
  
  // Stop reading button functionality could be added here
});