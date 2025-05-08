document.addEventListener("DOMContentLoaded", function () {
  // Get UI elements
  const enableToggle = document.getElementById("enableToggle");
  const zoomLensToggle = document.getElementById("zoomLensToggle");
  const readAloudToggle = document.getElementById("readAloudToggle");
  const describeImagesToggle = document.getElementById("describeImagesToggle");
  const readingSpeed = document.getElementById("readingSpeed");
  const volume = document.getElementById("volume");
  const highlightColor = document.getElementById("highlightColor");
  const voiceSelection = document.getElementById("voiceSelection");
  const status = document.getElementById("status");

  // State to track current settings
  let currentSettings = {
    enabled: false,
    zoomLensActive: false,
    readAloudActive: false,
    describeImagesActive: false,
    readingSpeed: "normal",
    volume: 0.8,
    highlightColor: "#4285F4",
    voiceName: null
  };

  // Initialize voice selection dropdown
  initializeVoiceSelection();

  // Load settings
  setTimeout(loadSettings, 30);

  // Check current status from active tab
  checkTabStatus();

  // Event Listeners
  enableToggle.addEventListener("change", function () {
    updateSetting("enabled", this.checked);
  });

  zoomLensToggle.addEventListener("change", function() {
    updateSetting("zoomLensActive", this.checked);
    updateFeatures();
  });
  
  readAloudToggle.addEventListener("change", function() {
    console.log("Change event triggered");
    updateSetting("readAloudActive", this.checked);
    updateFeatures();
  });

  describeImagesToggle.addEventListener("change", function() {
    updateSetting("describeImagesActive", this.checked);
    updateFeatures();
  });

  readingSpeed.addEventListener("change", function () {
    updateSetting("readingSpeed", this.value);
  });

  volume.addEventListener("input", function () {
    updateSetting("volume", parseFloat(this.value));
  });

  highlightColor.addEventListener("input", function () {
    updateSetting("highlightColor", this.value);
  });

  voiceSelection.addEventListener("change", function() {
    updateSetting("voiceName", this.value);
  });

    

  // Functions
  function loadSettings() {
    chrome.storage.sync.get(null, (settings) => {
      // Update our state object
      currentSettings = {
        ...currentSettings,
        ...settings,
        // Map old settings to new feature flags if necessary
        zoomLensActive: settings.zoomLensActive !== undefined ? settings.zoomLensActive : false,
        readAloudActive: settings.readAloudActive !== undefined ? settings.readAloudActive : false,
        describeImagesActive: settings.describeImagesActive !== undefined ? settings.describeImagesActive : false,
      };
      
      // Update UI to match settings
      enableToggle.checked = currentSettings.enabled;
      zoomLensToggle.checked = currentSettings.zoomLensActive;
      readAloudToggle.checked = currentSettings.readAloudActive;
      describeImagesToggle.checked = currentSettings.describeImagesActive;
      readingSpeed.value = currentSettings.readingSpeed;
      volume.value = currentSettings.volume;
      highlightColor.value = currentSettings.highlightColor;

      
      // Voice selection will be updated when voices are loaded
      if (currentSettings.voiceName && voiceSelection.querySelector(`option[value="${currentSettings.voiceName}"]`)) {
        voiceSelection.value = currentSettings.voiceName;
      }
      updateFeatures();
      // Update status message
      updateStatusMessage();
      
    });
  }

  function checkTabStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "getStatus" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log("Error getting status:", chrome.runtime.lastError);
              status.textContent = "Not available on this page";
              return;
            }
            
            if (response) {
              // Update status display based on response
              if (response.speaking) {
                status.textContent = "Currently reading text...";
                // Add a stop button
                addStopReadingButton();
              }
              
              // Sync our local state with content script state if different
              if (response.active !== currentSettings.enabled) {
                currentSettings.enabled = response.active;
                enableToggle.checked = response.active;
              }
              
              // Sync feature states if available
              if (response.features) {
                if (response.features.zoomLensActive !== undefined) {
                  currentSettings.zoomLensActive = response.features.zoomLensActive;
                  zoomLensToggle.checked = response.features.zoomLensActive;
                }
                
                if (response.features.readAloudActive !== undefined) {
                  currentSettings.readAloudActive = response.features.readAloudActive;
                  readAloudToggle.checked = response.features.readAloudActive;
                }
                
                if (response.features.describeImagesActive !== undefined) {
                  currentSettings.describeImagesActive = response.features.describeImagesActive;
                  describeImagesToggle.checked = response.features.describeImagesActive;
                }
              }
            }
          }
        );
      }
    });
  }

  function updateSetting(key, value) {
    // Update local state
    currentSettings[key] = value;
    
    // Save to storage
    chrome.storage.sync.set({ [key]: value }, () => {
      // Update status after saving
      updateStatusMessage();
      updateFeatures();
    });
  }

  function updateStatusMessage() {
    if (currentSettings.enabled) {
      let activeFeatures = [];
      if (currentSettings.zoomLensActive) activeFeatures.push("Zoom Lens");
      if (currentSettings.readAloudActive) activeFeatures.push("Read Aloud");
      if (currentSettings.describeImagesActive) activeFeatures.push("Describe Images");
      
      if (activeFeatures.length > 0) {
        status.textContent = `Active features: ${activeFeatures.join(", ")}`;
      } else {
        status.textContent = "Enabled, but no features are active. Enable features above.";
      }
    } else {
      status.textContent = "Disabled: Enable the toggle to start using AccessEd";
    }
  }

  function updateFeatures() {
    // Send updated features to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateFeatures",
          features: {
            biggerCursor: currentSettings.zoomLensActive,
            readAloud: currentSettings.readAloudActive,
            describeOnHover: currentSettings.describeImagesActive
          }
        });
      }
    });
  }

  function addStopReadingButton() {
    // Only add if it doesn't exist yet
    if (!document.getElementById("stopReadingBtn")) {
      const stopBtn = document.createElement("button");
      stopBtn.id = "stopReadingBtn";
      stopBtn.textContent = "Stop Reading";
      stopBtn.style.marginTop = "8px";
      stopBtn.style.padding = "4px 8px";
      stopBtn.style.backgroundColor = "#ea4335";
      stopBtn.style.color = "white";
      stopBtn.style.border = "none";
      stopBtn.style.borderRadius = "4px";
      stopBtn.style.cursor = "pointer";
      
      stopBtn.addEventListener("click", stopReading);
      
      status.appendChild(document.createElement("br"));
      status.appendChild(stopBtn);
    }
  }

  function stopReading() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "stopReading" }, (response) => {
          // Update status
          status.textContent = "Reading stopped";
          setTimeout(updateStatusMessage, 1500);
        });
      }
    });
  }

  function initializeVoiceSelection() {
    // Check if browser supports speech synthesis
    if (!window.speechSynthesis) {
      document.getElementById("voiceSelectionContainer").style.display = "none";
      return;
    }
    
    // Function to populate voices
    function populateVoices() {
      // Clear existing options except default
      while (voiceSelection.options.length > 1) {
        voiceSelection.remove(1);
      }
      
      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      
      // Add each voice as an option
      voices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' - Default' : ''}`;
        voiceSelection.appendChild(option);
      });
      
      // Set selected voice if one is saved
      if (currentSettings.voiceName) {
        const voiceOption = voiceSelection.querySelector(`option[value="${currentSettings.voiceName}"]`);
        if (voiceOption) {
          voiceSelection.value = currentSettings.voiceName;
        }
      }
    }
    
    // Chrome requires waiting for voiceschanged event
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
    
    // Initial population (for Firefox)
    populateVoices();
  }
});