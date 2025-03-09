chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "translate") {
        fetch("http://127.0.0.1:5000/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                word: request.word,
                sentence: request.sentence,
                index: request.index
            })
        })
            .then(response => response.json())
            .then(data => {
                const translationData = {
                    word: request.word,
                    translation: data.translation,
                    context: request.sentence,
                    url: sender.tab.url
                };
                // Retrieve existing translations
                chrome.storage.local.get({ savedTranslations: [] }, (result) => {
                    let translations = result.savedTranslations;
                    // Avoid duplicate entries
                    const exists = translations.some(t =>
                        t.word.toLowerCase() === translationData.word.toLowerCase() &&
                        t.url === translationData.url
                    );
                    if (!exists) {
                        translations.push(translationData);
                        chrome.storage.local.set({ savedTranslations: translations });
                    }
                });
                // Send translation to content script
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: "showTranslation",
                    translation: data.translation
                });
                sendResponse({ success: true, translation: data.translation });
            })
            .catch(error => {
                console.error("API Error:", error);
                sendResponse({ success: false, error: error.toString() });
            });
        return true; // Keep the message channel open
    } else if (request.type === "toggleExtension") {
        // Store the extension enabled state
        chrome.storage.local.set({ extensionEnabled: request.enabled }, () => {
            // Broadcast the toggle message to all tabs
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (!tab.url.startsWith('chrome://')) {
                        chrome.tabs.sendMessage(tab.id, {
                            type: "toggleExtension",
                            enabled: request.enabled
                        }).catch(err => console.log(`Could not send toggle message to tab ${tab.id}:`, err));
                    }
                });
            });
            // Send response back
            sendResponse({ success: true });
        });
        return true; // Keep the message channel open
    }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        // Check if extension is enabled before sending message
        chrome.storage.local.get({ extensionEnabled: true }, (data) => {
            if (data.extensionEnabled) {
                // Notify content script that page is fully loaded
                chrome.tabs.sendMessage(tabId, { type: "pageFullyLoaded" })
                    .catch(err => console.log("Error sending pageFullyLoaded message:", err));
            }
        });
    }
});

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "refreshHighlights",
        title: "Refresh Translation View",
        contexts: ["page"]
    });
    
    chrome.contextMenus.create({
        id: "toggleExtension",
        title: "Enable Translation Extension",
        contexts: ["page"]
    });
    
    // Set initial state
    chrome.storage.local.get({ extensionEnabled: true }, (data) => {
        if (!data.extensionEnabled) {
            chrome.contextMenus.update("toggleExtension", {
                title: "Enable Translation Extension"
            });
        } else {
            chrome.contextMenus.update("toggleExtension", {
                title: "Disable Translation Extension"
            });
        }
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "refreshHighlights") {
        // Send a message to refresh highlights instead of reloading
        chrome.tabs.sendMessage(tab.id, { type: "refreshHighlights" })
            .catch(err => {
                console.log("Error refreshing highlights, will reload page:", err);
                chrome.tabs.reload(tab.id);
            });
    } else if (info.menuItemId === "toggleExtension") {
        // Check current state and toggle
        chrome.storage.local.get({ extensionEnabled: true }, (data) => {
            const newState = !data.extensionEnabled;
            
            // Update context menu item text
            chrome.contextMenus.update("toggleExtension", {
                title: newState ? "Disable Translation Extension" : "Enable Translation Extension"
            });
            
            // Store new state and broadcast to all tabs
            chrome.runtime.sendMessage({
                type: "toggleExtension",
                enabled: newState
            });
        });
    }
});