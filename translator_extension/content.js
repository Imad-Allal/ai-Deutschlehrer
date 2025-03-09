let translateButton;
let currentTooltip;
let highlightingEnabled = true; // Flag to control highlighting feature
let currentSelection = null; // Store the current selection
let extensionEnabled = true; // Default to enabled

// Check if the extension is enabled
function checkExtensionEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ extensionEnabled: true }, (data) => {
            extensionEnabled = data.extensionEnabled;
            resolve(extensionEnabled);
        });
    });
}

// Create the floating button
function createTranslateButton(x, y) {
    // If extension is disabled, don't create the button
    if (!extensionEnabled) return;
    
    // Remove any existing buttons and tooltips
    removeExistingUI();
    translateButton = document.createElement("button");
    translateButton.innerText = "🔍 Translate";
    translateButton.style.position = "absolute";
    translateButton.style.left = `${x}px`;
    translateButton.style.top = `${y}px`;
    translateButton.style.background = "rgba(0, 0, 0, 0.68)";
    translateButton.style.color = "white";
    translateButton.style.border = "none";
    translateButton.style.padding = "5px 10px";
    translateButton.style.borderRadius = "5px";
    translateButton.style.cursor = "pointer";
    translateButton.style.zIndex = "10000";
    document.body.appendChild(translateButton);
}

// Remove any existing UI elements
function removeExistingUI() {
    if (translateButton) {
        translateButton.remove();
        translateButton = null;
    }
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
    }
}

// Find the sentence containing the selected word directly from the selection
function findSentenceFromSelection(selection) {
    if (!selection || !selection.rangeCount) return "";
    const selectedText = selection.toString().trim();
    if (!selectedText) return "";
    // Get the containing node where the selection is
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    // If we're in a text node, get its parent for more context
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
    }
    // Get text from the node and surrounding context
    let nodeText = '';
    // Try to get text from the immediate container
    nodeText = node.innerText || node.textContent || '';
    // If we don't have enough context, try to get from parent
    if (nodeText.length < 200 && node.parentNode) {
        nodeText = node.parentNode.innerText || node.parentNode.textContent || nodeText;
    }
    // If still not enough context, go up another level
    if (nodeText.length < 200 && node.parentNode && node.parentNode.parentNode) {
        nodeText = node.parentNode.parentNode.innerText || node.parentNode.parentNode.textContent || nodeText;
    }
    // Try to find the selected word in the context
    const wordIndex = nodeText.indexOf(selectedText);
    if (wordIndex === -1) {
        console.log(`Could not find "${selectedText}" in context`);
        return nodeText.length > 500 ? nodeText.substring(0, 500) + "..." : nodeText;
    }
    // Find sentence boundaries around the word
    let sentenceStart = nodeText.lastIndexOf('.', wordIndex);
    sentenceStart = sentenceStart === -1 ? 0 : sentenceStart + 1;
    // Also check for other sentence boundaries
    const lastQuestion = nodeText.lastIndexOf('?', wordIndex);
    const lastExclamation = nodeText.lastIndexOf('!', wordIndex);
    sentenceStart = Math.max(sentenceStart,
        lastQuestion === -1 ? 0 : lastQuestion + 1,
        lastExclamation === -1 ? 0 : lastExclamation + 1);
    let sentenceEnd = nodeText.indexOf('.', wordIndex + selectedText.length);
    const nextQuestion = nodeText.indexOf('?', wordIndex + selectedText.length);
    const nextExclamation = nodeText.indexOf('!', wordIndex + selectedText.length);
    // Find the closest sentence ending
    if (sentenceEnd === -1) sentenceEnd = nodeText.length;
    if (nextQuestion !== -1 && nextQuestion < sentenceEnd) sentenceEnd = nextQuestion + 1;
    if (nextExclamation !== -1 && nextExclamation < sentenceEnd) sentenceEnd = nextExclamation + 1;
    // Extract and clean the sentence
    let sentence = nodeText.substring(sentenceStart, sentenceEnd).trim();
    // If the sentence is too short, get more context
    if (sentence.length < 20) {
        // Just get a reasonable context window
        const contextStart = Math.max(0, wordIndex - 100);
        const contextEnd = Math.min(nodeText.length, wordIndex + selectedText.length + 100);
        sentence = nodeText.substring(contextStart, contextEnd).trim();
    }
    return sentence;
}

// Show loading indicator
function showLoading(x, y) {
    // If extension is disabled, don't show loading
    if (!extensionEnabled) return;
    
    removeExistingUI();
    currentTooltip = document.createElement("div");
    currentTooltip.innerText = "Translating...";
    currentTooltip.style.position = "absolute";
    currentTooltip.style.left = `${x}px`;
    currentTooltip.style.top = `${y}px`;
    currentTooltip.style.background = "#222";
    currentTooltip.style.color = "white";
    currentTooltip.style.padding = "5px 10px";
    currentTooltip.style.borderRadius = "5px";
    currentTooltip.style.zIndex = "10000";
    document.body.appendChild(currentTooltip);
}

// Highlight only the currently selected text
function highlightCurrentSelection() {
    // If extension is disabled, don't highlight
    if (!extensionEnabled) return;
    
    if (!currentSelection || !currentSelection.rangeCount) return;

    const range = currentSelection.getRangeAt(0);
    const selectedText = currentSelection.toString().trim();

    // Create a surrogate span element
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'highlighted-word';
    highlightSpan.setAttribute('data-word', selectedText.toLowerCase());

    // Don't modify DOM if the selection crosses multiple nodes (complex selection)
    try {
        // Extract the selected content
        const selectedContent = range.extractContents();
        // Add it to our highlight span
        highlightSpan.appendChild(selectedContent);
        // Insert the highlight span at the position of the original selection
        range.insertNode(highlightSpan);

        // Save this highlight to storage with XPath information
        saveHighlightInfo(selectedText, getXPathForElement(highlightSpan));

        // Clear the selection
        currentSelection.removeAllRanges();
    } catch (e) {
        console.error("Error highlighting selection:", e);
    }
}

// Save highlighted word information for persistence
function saveHighlightInfo(word, xpath) {
    chrome.storage.local.get({ pageHighlights: {} }, (result) => {
        let pageHighlights = result.pageHighlights;
        const url = window.location.href;

        if (!pageHighlights[url]) {
            pageHighlights[url] = [];
        }

        // Check if we already have this word highlighted
        const existingIndex = pageHighlights[url].findIndex(h => h.word === word && h.xpath === xpath);

        if (existingIndex === -1) {
            pageHighlights[url].push({
                word: word,
                xpath: xpath,
                timestamp: Date.now()
            });

            chrome.storage.local.set({ pageHighlights: pageHighlights });
            console.log(`Saved highlight for "${word}" at ${xpath}`);
        }
    });
}

// Get XPath for an element
function getXPathForElement(element) {
    if (!element) return '';

    try {
        // Use a simple path strategy based on parent chain and node index
        let path = '';
        for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
            const index = getElementIndex(element);
            const tagName = element.tagName.toLowerCase();
            path = `/${tagName}[${index}]${path}`;
        }
        return path;
    } catch (e) {
        console.error("Error getting XPath:", e);
        return '';
    }
}

// Get the index of an element among its siblings of the same type
function getElementIndex(element) {
    if (!element) return 0;

    let count = 1;
    let sibling = element.previousSibling;

    while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE &&
            sibling.tagName === element.tagName) {
            count++;
        }
        sibling = sibling.previousSibling;
    }

    return count;
}

// Find element by XPath
function getElementByXPath(xpath) {
    try {
        return document.evaluate(
            xpath, document, null,
            XPathResult.FIRST_ORDERED_NODE_TYPE, null
        ).singleNodeValue;
    } catch (e) {
        console.error("Error finding element by XPath:", e);
        return null;
    }
}

// Highlight all saved words on page load
function restoreHighlights() {
    // If extension is disabled, don't restore highlights
    if (!extensionEnabled) return;
    
    chrome.storage.local.get({ pageHighlights: {}, savedTranslations: [] }, (result) => {
        const pageHighlights = result.pageHighlights;
        const url = window.location.href;
        const translations = result.savedTranslations;

        if (!pageHighlights[url] || pageHighlights[url].length === 0) {
            console.log("No highlights to restore for this page");
            return;
        }

        console.log(`Restoring ${pageHighlights[url].length} highlights`);

        // Prepare translation map for quick lookup
        const translationMap = {};
        translations.forEach(t => {
            translationMap[t.word.toLowerCase()] = t.translation;
        });
        
        // Keep track of already highlighted words to avoid duplicates
        const highlightedWords = new Set();
        
        // First pass: Try XPath-based restoration
        pageHighlights[url].forEach(highlight => {
            const word = highlight.word.toLowerCase();
            
            // Skip if already highlighted in this session
            if (highlightedWords.has(word)) {
                return;
            }
            
            try {
                const element = getElementByXPath(highlight.xpath);
                if (element) {
                    console.log(`Found element for "${word}" by XPath`);

                    // Check if this is already highlighted
                    if (element.classList && element.classList.contains('highlighted-word')) {
                        console.log(`Element for "${word}" is already highlighted`);
                        highlightedWords.add(word);
                        return;
                    }

                    // Check if the element contains our word
                    const text = element.innerText || element.textContent;
                    if (text && text.toLowerCase().includes(word)) {
                        // Already a span with correct class, just make sure data-word is set
                        element.setAttribute('data-word', word);
                        element.classList.add('highlighted-word');
                        highlightedWords.add(word);
                        // Add title if translation exists
                        if (translationMap[word]) {
                            element.setAttribute('title', translationMap[word]);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error restoring highlight for "${word}" by XPath:`, e);
            }
        });

        // Second pass: Text-based restoration for words that haven't been found
        // Run a separate TreeWalker process for each word to prevent DOM changes
        // from invalidating our text node collection
        pageHighlights[url].forEach(highlight => {
            const word = highlight.word.toLowerCase();
            
            // Skip if already highlighted in this session
            if (highlightedWords.has(word)) {
                return;
            }
            
            // Collect text nodes for this word
            const textNodes = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        // Only accept nodes that contain our word
                        return (node.nodeValue.toLowerCase().indexOf(word) !== -1) ? 
                            NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                },
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
            // Try to highlight the first occurrence
            for (let i = 0; i < textNodes.length; i++) {
                const textNode = textNodes[i];
                const text = textNode.nodeValue;
                const lowerText = text.toLowerCase();
                const wordIndex = lowerText.indexOf(word);

                if (wordIndex !== -1) {
                    try {
                        // Create range for the word
                        const range = document.createRange();
                        range.setStart(textNode, wordIndex);
                        range.setEnd(textNode, wordIndex + word.length);

                        // Create highlight span
                        const highlightSpan = document.createElement('span');
                        highlightSpan.className = 'highlighted-word';
                        highlightSpan.setAttribute('data-word', word);

                        // If we have a translation for this word, add title attribute
                        if (translationMap[word]) {
                            highlightSpan.setAttribute('title', translationMap[word]);
                        }

                        // Extract and wrap the text
                        const selectedContent = range.extractContents();
                        highlightSpan.appendChild(selectedContent);
                        range.insertNode(highlightSpan);

                        // Update XPath in storage to reflect the new position
                        updateHighlightXPath(highlight.word, getXPathForElement(highlightSpan));
                        
                        // Mark as highlighted
                        highlightedWords.add(word);
                        
                        console.log(`Successfully highlighted "${word}" via text search`);
                        break;
                    } catch (e) {
                        console.error(`Error highlighting "${word}":`, e);
                    }
                }
            }
        });
    });
}

// Update XPath for a highlight
function updateHighlightXPath(word, newXPath) {
    chrome.storage.local.get({ pageHighlights: {} }, (result) => {
        let pageHighlights = result.pageHighlights;
        const url = window.location.href;

        if (pageHighlights[url]) {
            const highlight = pageHighlights[url].find(h => h.word === word);
            if (highlight) {
                highlight.xpath = newXPath;
                chrome.storage.local.set({ pageHighlights: pageHighlights });
            }
        }
    });
}

// Show the button when text is selected
document.addEventListener("mouseup", async (event) => {
    // Check if extension is enabled first
    await checkExtensionEnabled();
    
    // If extension is disabled, don't show button
    if (!extensionEnabled) return;
    
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText.length > 0) {
            // Save the current selection for later use
            currentSelection = selection;

            // Extract the sentence containing the selected word
            const sentence = findSentenceFromSelection(selection);
            // Calculate an approximate index (used only for API consistency)
            const documentText = document.body.innerText || "";
            const approximateIndex = documentText.indexOf(selectedText);
            // Create the translate button near where the mouse was released
            createTranslateButton(event.pageX - 4, event.pageY + 4);
            translateButton.onclick = () => {
                const buttonX = translateButton.offsetLeft;
                const buttonY = translateButton.offsetTop;
                // Show loading message
                showLoading(buttonX, buttonY);
                console.log("Sending translation request:", {
                    type: "translate",
                    word: selectedText,
                    sentence: sentence,
                    index: approximateIndex
                });
                chrome.runtime.sendMessage({
                    type: "translate",
                    word: selectedText,
                    sentence: sentence,
                    index: approximateIndex
                }, (response) => {
                    console.log("Content script received response:", response);
                    if (response && response.success) {
                        // Highlight the selection first, then show tooltip
                        highlightCurrentSelection();
                        showTooltip(response.translation, buttonX, buttonY);
                    }
                });
            };
        } else if (!isMouseOverElement(event, currentTooltip) && !isMouseOverElement(event, translateButton)) {
            removeExistingUI();
        }
    }, 100);
});

// Check if mouse is over an element
function isMouseOverElement(event, element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
    );
}

// Listen for translation response from background
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("Message received in content script:", request);

    // Handle extension state changes immediately
    if (request.type === "extensionStateChanged") {
        extensionEnabled = request.enabled;
        console.log(`Extension enabled state changed to: ${extensionEnabled}`);
        
        // If disabled, remove any existing UI
        if (!extensionEnabled) {
            removeExistingUI();
            // Remove all highlights from page
            removeAllHighlights();
        } else {
            // If enabled, restore highlights
            restoreHighlights();
        }
        
        return true;
    }
    
    // For all other message types, first check if extension is enabled
    await checkExtensionEnabled();
    if (!extensionEnabled) {
        console.log("Extension is disabled. Ignoring message:", request.type);
        return true;
    }

    if (request.type === "showTranslation") {
        // Highlight the selection first, then show tooltip
        highlightCurrentSelection();

        if (translateButton) {
            showTooltip(request.translation, translateButton.offsetLeft, translateButton.offsetTop);
        } else {
            // If button is gone, show in the center of the viewport
            const x = window.innerWidth / 2;
            const y = window.innerHeight / 2;
            showTooltip(request.translation, x, y);
        }
    } else if (request.type === "pageFullyLoaded" || request.type === "refreshHighlights") {
        // Restore highlights when requested
        restoreHighlights();
    } else if (request.type === "updateHighlightColor") {
        // Update highlight color
        updateHighlightColor(request.color);
    } else if (request.type === "removeHighlight") {
        // Remove specific highlight
        removeHighlightByWord(request.word);
    }

    return true;
});

// Remove all highlights from the page
function removeAllHighlights() {
    const highlights = document.querySelectorAll('.highlighted-word');
    
    highlights.forEach(el => {
        // Replace the highlighted span with its text content
        const text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
    });
}

// Function to update highlight color
function updateHighlightColor(color) {
    // Store the new color in storage
    chrome.storage.local.set({ highlightColor: color });
    
    // Update existing highlights on the page
    const style = document.getElementById('translator-highlight-styles');
    if (style) {
        style.textContent = `
            .highlighted-word {
                background-color: ${color} !important;
                color: black !important;
                padding: 0 2px !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                display: inline !important;
                position: relative !important;
                z-index: 1 !important;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important;
                transition: background-color 0.2s ease !important;
            }
            
            .highlighted-word:hover {
                background-color: ${adjustColor(color, -20)} !important;
            }
        `;
    }
}

// Helper function to darken/lighten a color for hover effect
function adjustColor(color, percent) {
    // Convert hex to RGB
    let r = parseInt(color.substring(1, 3), 16);
    let g = parseInt(color.substring(3, 5), 16);
    let b = parseInt(color.substring(5, 7), 16);

    // Adjust percentage (negative makes darker, positive makes lighter)
    r = Math.max(0, Math.min(255, r + percent));
    g = Math.max(0, Math.min(255, g + percent));
    b = Math.max(0, Math.min(255, b + percent));

    // Convert back to hex
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Function to remove highlight by word
function removeHighlightByWord(word) {
    const highlights = document.querySelectorAll('.highlighted-word');
    
    highlights.forEach(el => {
        if (el.getAttribute('data-word') === word) {
            // Replace the highlighted span with its text content
            const text = document.createTextNode(el.textContent);
            el.parentNode.replaceChild(text, el);
        }
    });
}

// Update the injectHighlightStyles function to use the stored color
function injectHighlightStyles() {
    if (document.getElementById('translator-highlight-styles')) return;

    // Get the stored highlight color or use default
    chrome.storage.local.get({ highlightColor: "#ffde59" }, (data) => {
        const color = data.highlightColor;
        
        const style = document.createElement('style');
        style.id = 'translator-highlight-styles';
        style.textContent = `
            .highlighted-word {
                background-color: ${color} !important;
                color: black !important;
                padding: 0 2px !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                display: inline !important;
                position: relative !important;
                z-index: 1 !important;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important;
                transition: background-color 0.2s ease !important;
            }
            
            .highlighted-word:hover {
                background-color: ${adjustColor(color, -20)} !important;
            }
        `;
        document.head.appendChild(style);
        console.log("Highlight styles injected with color:", color);
    });
}

// Display translation tooltip
function showTooltip(text, x, y) {
    removeExistingUI();
    currentTooltip = document.createElement("div");
    currentTooltip.innerText = text;
    currentTooltip.style.position = "absolute";
    currentTooltip.style.left = `${x}px`;
    currentTooltip.style.top = `${y}px`;
    currentTooltip.style.background = "#222";
    currentTooltip.style.color = "white";
    currentTooltip.style.padding = "10px 15px";
    currentTooltip.style.borderRadius = "5px";
    currentTooltip.style.zIndex = "10000";
    currentTooltip.style.maxWidth = "300px";
    currentTooltip.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    // Add close button
    const closeBtn = document.createElement("span");
    closeBtn.innerText = "×";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "5px";
    closeBtn.style.right = "10px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.fontWeight = "bold";
    closeBtn.onclick = removeExistingUI;
    currentTooltip.appendChild(closeBtn);
    document.body.appendChild(currentTooltip);
}

// Listen for clicks outside the UI elements
document.addEventListener("click", (event) => {
    if (!isMouseOverElement(event, currentTooltip) && !isMouseOverElement(event, translateButton)) {
        removeExistingUI();
    }
});

// Add click handler for removing highlighted words when clicked
document.addEventListener('click', (event) => {
    // Check if extension is enabled
    if (!extensionEnabled) return;
    
    if (!event.target.classList.contains('highlighted-word')) return;

    const word = event.target.getAttribute('data-word');
    if (!word) return;

    console.log(`Removing highlight for: ${word}`);

    // Replace the highlighted span with its text content
    const text = document.createTextNode(event.target.textContent);
    event.target.parentNode.replaceChild(text, event.target);

    // Remove from local highlight storage
    removeHighlightFromStorage(word);

    // Optional: Also remove from translation storage if needed
    chrome.storage.local.get('savedTranslations', (data) => {
        const translations = data.savedTranslations || [];
        const newTranslations = translations.filter(item =>
            item.word.toLowerCase() !== word.toLowerCase()
        );

        chrome.storage.local.set({ savedTranslations: newTranslations });
    });
});

// Remove a highlight from storage
function removeHighlightFromStorage(word) {
    chrome.storage.local.get({ pageHighlights: {} }, (result) => {
        let pageHighlights = result.pageHighlights;
        const url = window.location.href;

        if (pageHighlights[url]) {
            pageHighlights[url] = pageHighlights[url].filter(h =>
                h.word.toLowerCase() !== word.toLowerCase()
            );

            chrome.storage.local.set({ pageHighlights: pageHighlights });
            console.log(`Removed highlight for "${word}" from storage`);
        }
    });
}

// Add custom CSS for highlights
function injectHighlightStyles() {
    if (document.getElementById('translator-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'translator-highlight-styles';
    style.textContent = `
        .highlighted-word {
            background-color: #ffde59 !important;
            color: black !important;
            padding: 0 2px !important;
            border-radius: 3px !important;
            cursor: pointer !important;
            display: inline !important;
            position: relative !important;
            z-index: 1 !important;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important;
            transition: background-color 0.2s ease !important;
        }
        
        .highlighted-word:hover {
            background-color: #ffa726 !important;
        }
    `;
    document.head.appendChild(style);
    console.log("Highlight styles injected");
}

// Initialize on page load
async function initialize() {
    // First check if extension is enabled
    await checkExtensionEnabled();
    
    injectHighlightStyles();
    
    // Only restore highlights if extension is enabled
    if (extensionEnabled) {
        restoreHighlights();
    }
    
    console.log(`Translator extension initialized (enabled: ${extensionEnabled})`);
}

// Initialize on script load
initialize();

// Also initialize after DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // DOM is already loaded, initialize immediately
    initialize();
}

// Also try again after window load
window.addEventListener('load', initialize);

// Set up a mutation observer to detect dynamic content changes
const observeDOM = (function () {
    const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    return function (obj, callback) {
        if (!obj || obj.nodeType !== 1) return;

        if (MutationObserver) {
            // Define a new observer
            const mutationObserver = new MutationObserver(callback)

            // Have the observer observe for changes in children
            mutationObserver.observe(obj, { childList: true, subtree: true });
            return mutationObserver;
        }
        else if (window.addEventListener) {
            // Fallback for older browsers
            obj.addEventListener('DOMNodeInserted', callback, false);
            obj.addEventListener('DOMNodeRemoved', callback, false);
        }
    }
})();

// Use the mutation observer to detect when we might need to refresh highlights
// This is useful for single-page applications where content changes dynamically
observeDOM(document.body, function (mutations) {
    // Don't refresh if extension is disabled
    if (!extensionEnabled) return;
    
    // Throttle the refresh to prevent performance issues
    if (window.highlightRefreshTimeout) {
        clearTimeout(window.highlightRefreshTimeout);
    }

    window.highlightRefreshTimeout = setTimeout(() => {
        console.log("DOM changed significantly, refreshing highlights");
        restoreHighlights();
    }, 1000); // Wait 1 second after DOM changes before refreshing
});