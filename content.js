// content.js - Handles on-page functionality and background operations

// Unified state management
const state = {
  isActive: false,
  isSpeaking: false,
  zoomLensActive: false,
  readAloudActive: false,
  describeImagesActive: false,
  settings: {
    cursorSize: "medium",
    readingSpeed: "normal",
    highlightColor: "#4285F4",
    volume: 0.8,
    voiceName: null // Added voice selection option
  }
};

// Constants
const DESCRIBE_ENDPOINT = "https://b33.pythonanywhere.com/describe_image";
const LENS_SIZE = 150; // Diameter of the lens in pixels
const ZOOM_LEVEL = 10; // Magnification level
const IMAGE_DESCRIPTION_CACHE = new Map(); // Cache for image descriptions

// DOM Elements
let zoomLens = null;
let speechIndicator = null; // Visual indicator for active speech
let utterance = null;

// Initialize extension
function initializeExtension() {
  // Create necessary UI elements but keep hidden until needed
  createZoomLens();
  createSpeechIndicator();
  
  // Register key event handlers for keyboard shortcuts
  registerKeyboardShortcuts();
  
  // Get settings from storage and initialize state
  chrome.storage.sync.get(null, (data) => {
    if (data) {
      state.settings = {
        ...state.settings,
        ...data
      };
      state.isActive = !!data.enabled;
      
      // Initialize features based on settings
      if (state.isActive) {
        enableExtension();
      }
    }
  });
  
  // Listen for changes in settings
  chrome.storage.onChanged.addListener(handleSettingsChange);
  
  // Set up unified message listener
  chrome.runtime.onMessage.addListener(handleMessages);
  
  // Request initial settings
  chrome.runtime.sendMessage({ action: "getSettings" });
}

// Handle settings changes
function handleSettingsChange(changes) {
  // Update local settings
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key === 'enabled') {
      const wasActive = state.isActive;
      state.isActive = !!newValue;
      
      if (state.isActive && !wasActive) {
        enableExtension();
      } else if (!state.isActive && wasActive) {
        disableExtension();
      }
    } else if (key in state.settings) {
      state.settings[key] = newValue;
    }
  }
  
  // Update feature states based on changed settings
  updateFeatureStates();
}

// Unified message handler
function handleMessages(message, sender, sendResponse) {
  switch (message.action) {
    case "getStatus":
      sendResponse({
        active: state.isActive,
        speaking: state.isSpeaking,
        features: {
          zoomLensActive: state.zoomLensActive,
          readAloudActive: state.readAloudActive,
          describeImagesActive: state.describeImagesActive
        }
      });
      break;
      
    case "readText":
      if (message.text) {
        readText(message.text);
        sendResponse({ success: true });
      }
      break;
      
    case "stopReading":
      stopSpeech();
      sendResponse({ success: true });
      break;
      
    case "updateFeatures":
      if (message.features) {
        state.zoomLensActive = !!message.features.biggerCursor;
        state.readAloudActive = !!message.features.readAloud;
        state.describeImagesActive = !!message.features.describeOnHover;
        updateFeatureStates();
        sendResponse({ status: "Features updated" });
      }
      break;
      
    case "updateSettings":
      if (message.settings) {
        state.settings = { ...state.settings, ...message.settings };
        state.isActive = !!message.settings.enabled;
        updateFeatureStates();
        sendResponse({ success: true });
      }
      break;
      
    case "readTextDirectly":
      if (message.text) {
        readText(message.text);
        sendResponse({ success: true });
      }
      break;
      
    default:
      // Unknown action, don't handle
      return false;
  }
  
  return true; // Required for async response
}

// Enable all extension features
function enableExtension() {
  document.body.classList.add("whisper-web-active");
  
  // Add unified event listeners
  document.addEventListener("mouseover", handleInteractions);
  document.addEventListener("mousemove", handleInteractions);
  document.addEventListener("click", handleInteractions);
  document.addEventListener("dblclick", handleInteractions);
  document.addEventListener("keydown", handleInteractions);
  
  updateFeatureStates();
}

// Disable all extension features
function disableExtension() {
  document.body.classList.remove("whisper-web-active");
  
  // Remove unified event listeners
  document.removeEventListener("mouseover", handleInteractions);
  document.removeEventListener("mousemove", handleInteractions);
  document.removeEventListener("click", handleInteractions);
  document.removeEventListener("dblclick", handleInteractions);
  document.removeEventListener("keydown", handleInteractions);
  
  // Clean up any active features
  stopSpeech();
  hideZoomLens();
  removeAllHighlights();
  hideSpeechIndicator();
  
  // Reset cursor
  document.body.style.cursor = "default";
}

// Update feature states based on settings
function updateFeatureStates() {
  // Handle zoom lens (bigger cursor)
  if (state.isActive && state.zoomLensActive) {
    document.body.style.cursor = "'url(/assets/cursor.png), auto";
  } else {
    hideZoomLens();
    document.body.style.cursor = "default";
  }
  
  // Other features don't need visual updates here,
  // they're handled through the event listeners
}

// UNIFIED EVENT HANDLER
function handleInteractions(event) {
  if (!state.isActive) return;
  
  const eventType = event.type;
  
  switch (eventType) {
    case "mouseover":
      if (event.target.tagName === "IMG" && state.describeImagesActive) {
        handleImageHover(event);
      } else {
        handleElementHighlight(event);
      }
      break;
      
    case "mousemove":
      if (state.zoomLensActive) {
        updateZoomLens(event);
      }
      break;
      
    case "click":
      if (state.readAloudActive) {
        handleReadAloudClick(event);
      }
      break;
      
    case "dblclick":
      handleElementActivation(event);
      break;
      
    case "keydown":
      handleKeyboardNavigation(event);
      break;
  }
}

// HIGHLIGHT FUNCTIONALITY
function handleElementHighlight(event) {
  // Only highlight if we're active
  if (!state.isActive) return;
  
  // Remove previous highlights
  removeAllHighlights();
  
  const interactiveElement = getInteractiveElement(event.target);
  
  if (interactiveElement) {
    highlightElement(interactiveElement);
  }
}

// Get the closest interactive element
function getInteractiveElement(element) {
  const interactiveSelectors = 
    'a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  
  if (element.matches && element.matches(interactiveSelectors)) {
    return element;
  }
  
  // Check if the element is a text node
  if (element.nodeType === Node.TEXT_NODE || 
      (element.childNodes && element.childNodes.length === 1 && 
       element.firstChild.nodeType === Node.TEXT_NODE)) {
    return element;
  }
  
  // Check if any parent is interactive
  let parent = element.closest && element.closest(interactiveSelectors);
  if (parent) {
    return parent;
  }
  
  return element;
}

// Highlight an element with a border
function highlightElement(element) {
  if (!element || !element.classList) return;
  
  element.classList.add("whisper-web-highlight");
  
  // Use custom highlight color from settings
  element.style.outline = `5px solid ${state.settings.highlightColor || "#4285F4"}`;
  element.style.outlineOffset = "2px";
  
  // Add ARIA attributes for screen readers
  if (!element.getAttribute("aria-describedby")) {
    const id = `whisper-highlight-${Date.now()}`;
    element.setAttribute("aria-describedby", id);
    
    // Create description for screen readers
    const description = document.createElement("div");
    description.id = id;
    description.className = "whisper-sr-only";
    description.textContent = "Highlighted element. Click to hear description. Double click to activate.";
    description.style.position = "absolute";
    description.style.width = "2px";
    description.style.height = "1px";
    description.style.overflow = "hidden";
    description.style.clip = "rect(0, 0, 0, 0)";
    document.body.appendChild(description);
  }
}

// Remove all highlights
function removeAllHighlights() {
  document.querySelectorAll(".whisper-web-highlight").forEach(el => {
    el.classList.remove("whisper-web-highlight");
    el.style.outline = "";
    el.style.outlineOffset = "";
    
    // Clean up ARIA attributes
    const descId = el.getAttribute("aria-describedby");
    if (descId && descId.startsWith("whisper-highlight-")) {
      el.removeAttribute("aria-describedby");
      const desc = document.getElementById(descId);
      if (desc) desc.remove();
    }
  });
}

// ZOOM LENS FUNCTIONALITY
function createZoomLens() {
  if (zoomLens) return; // Already created
  
  zoomLens = document.createElement("div");
  zoomLens.id = "whisper-zoom-lens";
  zoomLens.setAttribute("aria-hidden", "true"); // Hide from screen readers
  zoomLens.style.position = "absolute";
  zoomLens.style.border = "solid green";
  zoomLens.style.borderWidth = "150px";
  zoomLens.style.borderRadius = "50%";
  zoomLens.style.width = `${LENS_SIZE}px`;
  zoomLens.style.height = `${LENS_SIZE}px`;
  zoomLens.style.pointerEvents = "none"; // Ignore mouse events
  zoomLens.style.display = "none"; // Initially hidden
  zoomLens.style.overflow = "hidden";
  zoomLens.style.zIndex = "999999"; // Ensure it's on top
  zoomLens.style.boxShadow = "0 0 10px rgba(121, 121, 121, 0.5)";
  
  // Create a canvas element for better performance
  const canvas = document.createElement("canvas");
  canvas.width = LENS_SIZE;
  canvas.height = LENS_SIZE;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  zoomLens.appendChild(canvas);
  
  document.body.appendChild(zoomLens);
}

// Update zoom lens with improved performance
function updateZoomLens(e) {
  if (!zoomLens || !state.zoomLensActive) return;
  
  // Show the lens
  zoomLens.style.display = "block";
  
  // Calculate lens position (center on cursor)
  const lensX = e.pageX - LENS_SIZE / 2;
  const lensY = e.pageY - LENS_SIZE / 2;
  
  zoomLens.style.left = `${lensX}px`;
  zoomLens.style.top = `${lensY}px`;
  
  // Use canvas for better performance
  const canvas = zoomLens.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  
  // Clear previous content
  ctx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
  
  try {
    // Calculate the area to capture
    const captureX = Math.max(0, e.pageX - LENS_SIZE / (2 * ZOOM_LEVEL));
    const captureY = Math.max(0, e.pageY - LENS_SIZE / (2 * ZOOM_LEVEL));
    const captureSize = LENS_SIZE / ZOOM_LEVEL;
    
    // Draw the zoomed content
    ctx.save();
    ctx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
    
    // Use document as source - more efficient than trying to capture the exact element
    // This is a simplified approach. For a more accurate zoom, you would need
    // to use html2canvas or a similar library to capture the exact DOM state
    ctx.drawImage(
      document.documentElement,
      captureX, captureY, captureSize, captureSize,
      0, 0, LENS_SIZE / ZOOM_LEVEL, LENS_SIZE / ZOOM_LEVEL
    );
    
    ctx.restore();
  } catch (error) {
    // Fallback if the canvas approach fails
    console.error("Zoom lens rendering error:", error);
    
    // Use a simple color instead
    ctx.beginPath();
    ctx.arc(LENS_SIZE/2, LENS_SIZE/2, LENS_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Add text explaining the issue
    ctx.fillStyle = "#ff7f7f";
    ctx.font = "15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Zoom unavailable", LENS_SIZE/2, LENS_SIZE/2);

  }
}

// Hide the zoom lens
function hideZoomLens() {
  if (zoomLens) {
    zoomLens.style.display = "none";
  }
}

// SPEECH FUNCTIONALITY
function createSpeechIndicator() {
  if (speechIndicator) return; // Already created
  
  speechIndicator = document.createElement("div");
  speechIndicator.id = "whisper-speech-indicator";
  speechIndicator.setAttribute("role", "status");
  speechIndicator.setAttribute("aria-live", "polite");
  speechIndicator.textContent = "Speaking...";
  speechIndicator.style.position = "fixed";
  speechIndicator.style.bottom = "20px";
  speechIndicator.style.right = "20px";
  speechIndicator.style.background = "#4285F4";
  speechIndicator.style.color = "white";
  speechIndicator.style.padding = "10px 20px";
  speechIndicator.style.borderRadius = "2px";
  speechIndicator.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  speechIndicator.style.zIndex = "999999";
  speechIndicator.style.display = "none"; // Initially hidden
  speechIndicator.style.opacity = "0.9";
  speechIndicator.style.fontSize = "20px";
  speechIndicator.style.transition = "opacity 0.3s";
  
  // Add stop button
  const stopButton = document.createElement("button");
  stopButton.textContent = "✕";
  stopButton.style.marginLeft = "10px";
  stopButton.style.background = "white";
  stopButton.style.color = "#4285F4";
  stopButton.style.border = "none";
  stopButton.style.borderRadius = "50%";
  stopButton.style.width = "20px";
  stopButton.style.height = "20px";
  stopButton.style.cursor = "pointer";
  stopButton.style.display = "inline-flex";
  stopButton.style.justifyContent = "center";
  stopButton.style.alignItems = "center";
  stopButton.style.fontSize = "20px";
  stopButton.setAttribute("aria-label", "Stop speaking");
  
  stopButton.addEventListener("click", (e) => {
    e.stopPropagation();
    stopSpeech();
  });
  
  speechIndicator.appendChild(stopButton);
  document.body.appendChild(speechIndicator);
}

// Show speech indicator
function showSpeechIndicator(text) {
  if (!speechIndicator) createSpeechIndicator();
  
  // Update text (truncate if too long)
  const displayText = text.length > 50 ? text.substring(0, 47) + "..." : text;
  speechIndicator.childNodes[0].nodeValue = `Speaking: ${displayText}`;
  
  speechIndicator.style.display = "block";
}

// Hide speech indicator
function hideSpeechIndicator() {
  if (speechIndicator) {
    speechIndicator.style.display = "none";
  }
}

// Handle click for read aloud feature
function handleReadAloudClick(event) {
  if (!state.isActive || !state.readAloudActive) return;
  
  // Prevent default only for interactive elements
  const interactiveSelectors = 'a, button, input, select, textarea, [role="button"]';
  if (
    event.target.matches && 
    (event.target.matches(interactiveSelectors) || 
     (event.target.closest && event.target.closest(interactiveSelectors)))
  ) {
    event.preventDefault();
  }
  
  let textToRead = "";
  
  // Check if text is selected
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    textToRead = selectedText;
  } else {
    // Get text from the element
    const element = getInteractiveElement(event.target);
    textToRead = getElementText(element);
  }
  
  if (textToRead) {
    readText(textToRead);
  }
}

// Get readable text from an element with improved handling
function getElementText(element) {
  if (!element) return "";
  
  // For form elements, read their label or placeholder
  if (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  ) {
    // Try to find associated label
    const id = element.id;
    let labelText = "";
    
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        labelText = label.textContent.trim();
      }
    }
    
    // If no label found, try aria-label or aria-labelledby
    if (!labelText) {
      if (element.getAttribute("aria-labelledby")) {
        const labelId = element.getAttribute("aria-labelledby");
        const labelEl = document.getElementById(labelId);
        if (labelEl) {
          labelText = labelEl.textContent.trim();
        }
      } else if (element.getAttribute("aria-label")) {
        labelText = element.getAttribute("aria-label");
      }
    }
    
    // Still no label? Try placeholder or name
    if (!labelText) {
      labelText = element.placeholder || element.name || "Form field";
    }
    
    // For select boxes, read the selected option
    if (element.tagName === "SELECT" && element.options && element.options.length > 0) {
      return `${labelText}: ${element.options[element.selectedIndex].text}`;
    }
    
    // For checkboxes and radios, add checked/unchecked status
    if (element.type === "checkbox" || element.type === "radio") {
      return `${labelText}: ${element.checked ? "Checked" : "Not checked"}`;
    }
    
    return `${labelText}${element.value ? ": " + element.value : ""}`;
  }
  
  // For buttons, read their text content or aria-label
  if (
    element.tagName === "BUTTON" ||
    (element.getAttribute && element.getAttribute("role") === "button")
  ) {
    return (
      element.textContent?.trim() ||
      element.getAttribute("aria-label") ||
      "Button"
    );
  }
  
  // For links, read text content plus destination info
  if (element.tagName === "A") {
    let linkText =
      element.textContent?.trim() ||
      element.getAttribute("aria-label") ||
      "Link";
    
    // Add URL info for screen readers
    if (element.href) {
      // Get domain from href
      try {
        const url = new URL(element.href);
        if (url.hostname !== window.location.hostname) {
          linkText += `, links to ${url.hostname}`;
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    }
    
    return linkText;
  }
  
  // For images, read alt text or try to describe
  if (element.tagName === "IMG") {
    return element.alt || "Image";
  }
  
  // For regular text elements, just get the text content
  return element.textContent?.trim() || "";
}

// Read text using speech synthesis with improved error handling
function readText(text) {
  if (!text) return;
  
  // Stop any previous speech
  stopSpeech();
  
  try {
    utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    utterance.volume = state.settings.volume || 0.8;
    
    // Set rate based on reading speed setting
    switch (state.settings.readingSpeed) {
      case "slow":
        utterance.rate = 0.7;
        break;
      case "fast":
        utterance.rate = 1.3;
        break;
      default: // normal
        utterance.rate = 1.0;
    }
    
    // Use selected voice if available
    if (state.settings.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(voice => voice.name === state.settings.voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    // Event handlers for speech
    utterance.onstart = () => {
      state.isSpeaking = true;
      showSpeechIndicator(text);
    };
    
    utterance.onend = () => {
      state.isSpeaking = false;
      hideSpeechIndicator();
    };
    
    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      state.isSpeaking = false;
      hideSpeechIndicator();
      
      // Show error notification
      showNotification("Speech error: " + (event.error || "Unknown error"), "error");
    };
    
    // Speak the text
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error("Failed to initiate speech:", error);
    showNotification("Failed to start speech synthesis", "error");
  }
}


// Stop any ongoing speech
function stopSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  state.isSpeaking = false;
  hideSpeechIndicator();
  utterance = null;
}

// Handle image hover for description
async function handleImageHover(event) {
  if (!state.isActive || !state.describeImagesActive) return;
  
  const img = event.target;
  if (img.tagName !== "IMG" || !img.src) return;
  
  try {
    // Check cache first
    let description = IMAGE_DESCRIPTION_CACHE.get(img.src);
    
    if (!description) {
      // Show loading indicator
      img.style.outline = "2px dashed #46B8CC";
      
      // Try to use alt text first if available and meaningful
      if (img.alt && img.alt.length > 3 && img.alt !== "image") {
        description = `Image: ${img.alt}`;
      } else {
        // Fetch from API
        const response = await fetch(`${DESCRIBE_ENDPOINT}?url=${encodeURIComponent(img.src)}`)
          .then(res => {
            if (!res.ok) throw new Error(`Network error: ${res.status}`);
            return res.json();
          });
        
        description = response.description || "Image without description";
        
        // Cache the result
        IMAGE_DESCRIPTION_CACHE.set(img.src, description);
      }
      
      // Remove loading indicator
      img.style.outline = "";
    }
    
    // Read the description
    readText(description);
  } catch (error) {
    console.error("Failed to describe image:", error);
    
    // If API fails, try to use alt text as fallback
    if (img.alt) {
      readText(`Image with description: ${img.alt}`);
    } else {
      readText("Image without description");
    }
    
    // Remove loading indicator
    img.style.outline = "";
  }
}

// Handle double click to activate elements
function handleElementActivation(event) {
  if (!state.isActive) return;
  
  const interactiveElement = getInteractiveElement(event.target);
  
  // Only handle interactive elements
  const interactiveSelectors = 'a, button, input, select, textarea, [role="button"]';
  if (
    interactiveElement.matches && 
    (interactiveElement.matches(interactiveSelectors) || 
     (interactiveElement.closest && interactiveElement.closest(interactiveSelectors)))
  ) {
    try {
      // Stop any speech first
      stopSpeech();
      
      // Let the default action happen
      if (interactiveElement.tagName === "A" && interactiveElement.href) {
        window.location.href = interactiveElement.href;
      } else {
        interactiveElement.click();
      }
    } catch (error) {
      console.error("Failed to activate element:", error);
      showNotification("Failed to activate element", "error");
    }
  }
}

// KEYBOARD NAVIGATION
function handleKeyboardNavigation(event) {
  if (!state.isActive) return;
  
  // Handle keyboard shortcuts
  const ctrlKey = event.ctrlKey || event.metaKey;
  
  // Stop speech with Escape key
  if (event.key === "Escape" && state.isSpeaking) {
    stopSpeech();
    event.preventDefault();
    return;
  }
  
  // Toggle features with keyboard shortcuts
  if (ctrlKey) {
    switch (event.key) {
      case 'z': // Ctrl+Z to toggle zoom lens
        state.zoomLensActive = !state.zoomLensActive;
        updateFeatureStates();
        event.preventDefault();
        showNotification(`Bigger Cursor ${state.zoomLensActive ? 'enabled' : 'disabled'}`);
        break;
        
      case 'r': // Ctrl+R to toggle read aloud
        state.readAloudActive = !state.readAloudActive;
        updateFeatureStates();
        event.preventDefault();
        showNotification(`Read aloud ${state.readAloudActive ? 'enabled' : 'disabled'}`);
        break;
        
      case 'd': // Ctrl+D to toggle image descriptions
        state.describeImagesActive = !state.describeImagesActive;
        updateFeatureStates();
        event.preventDefault();
        showNotification(`Image descriptions ${state.describeImagesActive ? 'enabled' : 'disabled'}`);
        break;
    }
  }
}

// Register keyboard shortcuts
function registerKeyboardShortcuts() {
  // These are global shortcuts that work even when the extension isn't active
  document.addEventListener("keydown", (event) => {
    // Enable/disable the extension with Ctrl+Shift+W
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'W') {
      state.isActive = !state.isActive;
      
      if (state.isActive) {
        enableExtension();
        showNotification("AccessEd enabled");
      } else {
        disableExtension();
        showNotification("AccessEd disabled");
      }
      
      // Update storage
      chrome.storage.sync.set({ enabled: state.isActive });
      
      event.preventDefault();
    }
  });
}

// UTILITIES
// Show notification to the user
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = "whisper-notification";
  notification.setAttribute("role", "alert");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.right = "20px";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.zIndex = "999999";
  notification.style.maxWidth = "300px";
  notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  notification.style.animation = "whisper-fadeInOut 4s forwards";
  
  // Style based on type
  if (type === "error") {
    notification.style.background = "#F44336";
    notification.style.color = "white";
  } else {
    notification.style.background = "#4285F4";
    notification.style.color = "white";
  }
  
  // Add animation styles if they don't exist
  if (!document.getElementById("whisper-styles")) {
    const style = document.createElement("style");
    style.id = "whisper-styles";
    style.textContent = `
      @keyframes whisper-fadeInOut {
        0% { opacity: 0; transform: translateY(-20px); }
        10% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Remove after animation completes
  setTimeout(() => {
    notification.remove();
  }, 4000);
}

// Initialize when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  initializeExtension();
}