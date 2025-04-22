// content.js - Handles on-page functionality

let isExtensionActive = false;
let settings = {};
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

let features = {
    biggerCursor: false,
    readAloud: false
};

let zoomLens = null;
const LENS_SIZE = 150; // Diameter of the lens in pixels
const ZOOM_LEVEL = 2; // Magnification level

// Function to create and style the zoom lens
function createZoomLens() {
    if (zoomLens) return; // Already created
    zoomLens = document.createElement('div');
    zoomLens.style.position = 'absolute';
    zoomLens.style.border = '2px solid black';
    zoomLens.style.borderRadius = '50%';
    zoomLens.style.width = `${LENS_SIZE}px`;
    zoomLens.style.height = `${LENS_SIZE}px`;
    zoomLens.style.pointerEvents = 'none'; // Ignore mouse events
    zoomLens.style.display = 'none'; // Initially hidden
    zoomLens.style.overflow = 'hidden';
    zoomLens.style.zIndex = '999999'; // Ensure it's on top
    // Set background properties for zoom effect
    zoomLens.style.backgroundImage = `url(${document.body.style.backgroundImage || 'none'})`; // Use body background initially
    zoomLens.style.backgroundRepeat = 'no-repeat';
    zoomLens.style.backgroundSize = `${document.documentElement.scrollWidth * ZOOM_LEVEL}px ${document.documentElement.scrollHeight * ZOOM_LEVEL}px`;
    document.body.appendChild(zoomLens);
}

// Function to update zoom lens position and background
function updateZoomLens(e) {
    if (!zoomLens || !features.biggerCursor) return;

    // Calculate lens position (center on cursor)
    const lensX = e.pageX - LENS_SIZE / 2;
    const lensY = e.pageY - LENS_SIZE / 2;

    // Calculate background position
    // Center the background image view on the cursor position, then scale
    const bgX = -(e.pageX * ZOOM_LEVEL - LENS_SIZE / 2);
    const bgY = -(e.pageY * ZOOM_LEVEL - LENS_SIZE / 2);

    zoomLens.style.left = `${lensX}px`;
    zoomLens.style.top = `${lensY}px`;
    zoomLens.style.backgroundPosition = `${bgX}px ${bgY}px`;
    // Try to update background image dynamically (might be heavy/complex)
    // For simplicity, we are currently using the initial body background.
    // A more robust solution might involve canvas or cloning parts of the DOM.
    zoomLens.style.display = 'block';
}

// Function to remove the zoom lens
function removeZoomLens() {
    if (zoomLens) {
        zoomLens.remove();
        zoomLens = null;
    }
    document.removeEventListener('mousemove', updateZoomLens);
}

// Function to update features based on message from background
function updateFeatures(newFeatures) {
    features = newFeatures;

    // Handle Cursor Zoom (replaces biggerCursor)
    if (features.biggerCursor) {
        createZoomLens();
        document.addEventListener('mousemove', updateZoomLens);
        // Hide the default cursor when lens is active
        document.body.style.cursor = 'none';
    } else {
        removeZoomLens();
        // Restore default cursor
        document.body.style.cursor = 'default';
    }

    // Read Aloud feature doesn't need visual changes here, handled by click listener
}

// Listener for messages from background or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateFeatures") {
        updateFeatures(request.features);
        sendResponse({ status: "Features updated" });
    }
    return true; // Indicates asynchronous response handling
});

// Request initial feature states when content script loads
chrome.runtime.sendMessage({ action: "getFeatures" }, (response) => {
    if (chrome.runtime.lastError) {
        console.error("Error getting features:", chrome.runtime.lastError.message);
        // Set default state if background is not ready
        updateFeatures({ biggerCursor: false, readAloud: false });
    } else if (response && response.features) {
        updateFeatures(response.features);
    }
});

// Add click listener for Read Aloud feature
document.addEventListener('click', (event) => {
    if (features.readAloud) {
        const selectedText = window.getSelection().toString().trim();
        let textToRead = '';

        if (selectedText) {
            // If text is selected, read only the selection
            textToRead = selectedText;
        } else if (event.target instanceof Element) {
            // Otherwise, read the clicked element's text content (or parents)
            let targetElement = event.target;
            // Basic attempt to get meaningful text, might need refinement
            textToRead = targetElement.textContent || targetElement.innerText;
            // Avoid reading huge amounts of text if a large container is clicked
            if (textToRead && textToRead.length > 500) {
                 // Try finding a smaller relevant block like a paragraph
                 const paragraph = targetElement.closest('p');
                 if (paragraph) {
                     textToRead = paragraph.textContent || paragraph.innerText;
                 } else {
                    // Limit length if no better block found
                    textToRead = textToRead.substring(0, 500) + "...";
                 }
            }
        }

        if (textToRead) {
            console.log("Sending text to read:", textToRead);
            chrome.runtime.sendMessage({ action: "readText", text: textToRead });
        }
    }
}, true); // Use capture phase to potentially intercept clicks earlier

document.addEventListener("mouseover", async function (event) {
  const target = event.target.closest("img, [role='img']");
  if (target && target.tagName === "IMG") {
    const imageUrl = target.src;

    if (imageUrl) {
      console.log("Processing image with Gemini API:", imageUrl);

      try {
        const apiKey = "AIzaSyAdUqI2f1sIXWhOiu_VM1lg2UHxwAHLLaY";
        const apiUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files"; // Replace with the correct endpoint
        const prompt = "Describe the contents of this image in detail."; // Customize your prompt
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            image: imageUrl,
            prompt: prompt
          })
        });

        if (!response.ok) {
          const errorDetails = await response.json();
          console.error("Gemini API error details:", errorDetails);
          throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const textToRead = await response.json();
        console.log("Gemini API response:", textToRead);

        // Handle the result (e.g., display processed data or take further actions)
        if (textToRead) {
          console.log("Sending text to read:", textToRead);
          chrome.runtime.sendMessage({ action: "readText", text: textToRead });
        }
      } catch (error) {
        console.error("Error processing image with Gemini API:", error);
      }
    }
  }
});

// Function to display Gemini API result (example implementation)
function displayGeminiResult(result) {
  // You can customize this to display the result on the page
  alert(`Gemini API Result: ${JSON.stringify(result)}`);
}
// Initialize extension
function initializeExtension() {
  // Get settings from storage
  chrome.storage.sync.get(null, (data) => {
    settings = data;
    isExtensionActive = settings.enabled;
    
    if (isExtensionActive) {
      enableExtension();
    }
  });
  
  // Listen for changes in settings
  chrome.storage.onChanged.addListener((changes) => {
    // Update local settings
    for (let key in changes) {
      settings[key] = changes[key].newValue;
    }
    
    // Enable/disable based on settings
    if ('enabled' in changes) {
      isExtensionActive = changes.enabled.newValue;
      
      if (isExtensionActive) {
        enableExtension();
      } else {
        disableExtension();
      }
    }
  });
}

// Enable extension features
function enableExtension() {
  document.body.classList.add('whisper-web-active');
  
  // Add event listeners for interactive elements
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('click', handleClick);
  document.addEventListener('dblclick', handleDoubleClick);
}

// Disable extension features
function disableExtension() {
  document.body.classList.remove('whisper-web-active');
  
  // Remove event listeners
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('click', handleClick);
  document.removeEventListener('dblclick', handleDoubleClick);
  
  // Stop any ongoing speech
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  
  // Remove any highlights
  removeAllHighlights();
}

// Handler for mouse over events to highlight interactive elements
function handleMouseOver(event) {
  if (!isExtensionActive) return;
  
  // Remove previous highlights
  removeAllHighlights();
  
  const interactiveElement = getInteractiveElement(event.target);
  
  if (interactiveElement) {
    highlightElement(interactiveElement);
  }
}

// Get the closest interactive element (button, link, input, etc.)
function getInteractiveElement(element) {
  const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  
  if (element.matches(interactiveSelectors)) {
    return element;
  }
  
  // Check if the element is a text node
  if (element.nodeType === Node.TEXT_NODE || (element.childNodes.length === 1 && element.firstChild.nodeType === Node.TEXT_NODE)) {
    return element;
  }
  
  // Check if any parent is interactive
  let parent = element.closest(interactiveSelectors);
  if (parent) {
    return parent;
  }
  
  return element;
}

// Highlight an element with a border
function highlightElement(element) {
  element.classList.add('whisper-web-highlight');
  
  // Use custom highlight color from settings
  element.style.outlineColor = settings.highlightColor || '#4285F4';
}

// Remove all highlights
function removeAllHighlights() {
  document.querySelectorAll('.whisper-web-highlight').forEach(el => {
    el.classList.remove('whisper-web-highlight');
    el.style.outlineColor = '';
  });
}

// Handler for click events to read text
function handleClick(event) {
  if (!isExtensionActive) return;
  
  // Prevent default only for interactive elements to allow screen reading without activation
  const interactiveSelectors = 'a, button, input, select, textarea, [role="button"]';
  if (event.target.matches(interactiveSelectors) || event.target.closest(interactiveSelectors)) {
    event.preventDefault();
  }
  
  // Get text to read
  const element = getInteractiveElement(event.target);
  let textToRead = getElementText(element);
  
  if (textToRead) {
    readText(textToRead);
  }
}

// Handler for double click to activate elements
function handleDoubleClick(event) {
  if (!isExtensionActive) return;
  
  const interactiveElement = getInteractiveElement(event.target);
  
  // Only handle interactive elements
  const interactiveSelectors = 'a, button, input, select, textarea, [role="button"]';
  if (interactiveElement.matches(interactiveSelectors) || interactiveElement.closest(interactiveSelectors)) {
    // Let the default action happen
    if (interactiveElement.tagName === 'A') {
      window.location.href = interactiveElement.href;
    } else {
      interactiveElement.click();
    }
  }
}

// Get readable text from an element
function getElementText(element) {
  // For form elements, read their label or placeholder
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    // Try to find associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent.trim() + (element.value ? ': ' + element.value : '');
      }
    }
    
    // Use placeholder or name attribute
    if (element.placeholder) {
      return element.placeholder;
    }
    
    if (element.name) {
      return element.name + (element.value ? ': ' + element.value : '');
    }
    
    // For select boxes, read the selected option
    if (element.tagName === 'SELECT' && element.options.length > 0) {
      return 'Select dropdown. Selected: ' + element.options[element.selectedIndex].text;
    }
    
    return element.value || 'Interactive form element';
  }
  
  // For buttons, read their text content or aria-label
  if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
    return element.textContent.trim() || element.getAttribute('aria-label') || 'Button';
  }
  
  // For links, read text content plus destination info
  if (element.tagName === 'A') {
    let linkText = element.textContent.trim() || element.getAttribute('aria-label') || 'Link';
    
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
  
  // For regular text elements, just get the text content
  return element.textContent.trim();
}

// Read text using speech synthesis
function readText(text) {
  if (!text) return;
  
  // Stop any previous speech
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Apply settings
  utterance.volume = settings.volume || 0.8;
  
  // Set rate based on reading speed setting
  switch (settings.readingSpeed) {
    case 'slow':
      utterance.rate = 0.7;
      break;
    case 'fast':
      utterance.rate = 1.3;
      break;
    default: // normal
      utterance.rate = 1.0;
  }
  
  // Store current utterance
  currentUtterance = utterance;
  
  // Speak the text
  speechSynthesis.speak(utterance);
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "readText" && message.text) {
    readText(message.text);
  }
  
  if (message.action === "stopReading") {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
  }
  
  if (message.action === "getStatus") {
    sendResponse({
      active: isExtensionActive,
      speaking: speechSynthesis.speaking
    });
    return true;
  }
});

// Initialize on page load
initializeExtension();