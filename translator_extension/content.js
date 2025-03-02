let translateButton;
let currentTooltip;

// Create the floating button
function createTranslateButton(x, y) {
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

// Show the button when text is selected
document.addEventListener("mouseup", (event) => {
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length > 0) {
            // Extract the sentence containing the selected word
            const sentence = findSentenceFromSelection(selection);

            // Calculate an approximate index (used only for API consistency)
            const documentText = document.body.innerText || "";
            const approximateIndex = documentText.indexOf(selectedText);

            // Create the translate button near where the mouse was released
            createTranslateButton(event.pageX, event.pageY);
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
chrome.runtime.onMessage.addListener((request) => {
    console.log("Message received in content script:", request);
    if (request.type === "showTranslation") {
        if (translateButton) {
            showTooltip(request.translation, translateButton.offsetLeft, translateButton.offsetTop);
        } else {
            // If button is gone, show in the center of the viewport
            const x = window.innerWidth / 2;
            const y = window.innerHeight / 2;
            showTooltip(request.translation, x, y);
        }
    }
    return true;
});

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