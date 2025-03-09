chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "translate") {
        // First check if extension is enabled
        chrome.storage.local.get({ extensionEnabled: true }, (data) => {
            if (!data.extensionEnabled) {
                sendResponse({ success: false, error: "Extension is disabled" });
                return;
            }
            
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
        });
        return true; // Keep the message channel open
    }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // First check if extension is enabled
    chrome.storage.local.get({ extensionEnabled: true }, (data) => {
        if (!data.extensionEnabled) return; // Do nothing if extension is disabled
        
        if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
            // Notify content script that page is fully loaded
            chrome.tabs.sendMessage(tabId, { type: "pageFullyLoaded" })
                .catch(err => console.log("Error sending pageFullyLoaded message:", err));
        }
    });
});

// Create a context menu item
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "refreshHighlights",
        title: "Refresh Translation View",
        contexts: ["page"]
    });
    
    chrome.contextMenus.create({
        id: "toggleExtension",
        title: "Disable Translator",
        contexts: ["action"]
    });
    
    // Set default state in storage if not already set
    chrome.storage.local.get({ extensionEnabled: true }, (data) => {
        // Update badge if extension is initially disabled
        if (!data.extensionEnabled) {
            chrome.action.setBadgeText({ text: "OFF" });
            chrome.action.setBadgeBackgroundColor({ color: "#FF5252" });
            
            // Also update context menu title
            chrome.contextMenus.update("toggleExtension", {
                title: "Enable Translator"
            });
        }
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "refreshHighlights") {
        // First check if extension is enabled
        chrome.storage.local.get({ extensionEnabled: true }, (data) => {
            if (!data.extensionEnabled) {
                // Maybe show a notification that extension is disabled?
                return;
            }
            
            // Send a message to refresh highlights instead of reloading
            chrome.tabs.sendMessage(tab.id, { type: "refreshHighlights" })
                .catch(err => {
                    console.log("Error refreshing highlights, will reload page:", err);
                    chrome.tabs.reload(tab.id);
                });
        });
    }
    else if (info.menuItemId === "toggleExtension") {
        // Toggle the extension state
        chrome.storage.local.get({ extensionEnabled: true }, (data) => {
            const newState = !data.extensionEnabled;
            chrome.storage.local.set({ extensionEnabled: newState }, () => {
                // Update the menu title based on the new state
                chrome.contextMenus.update("toggleExtension", {
                    title: newState ? "Disable Translator" : "Enable Translator"
                });
                
                // Update badge
                if (newState) {
                    chrome.action.setBadgeText({ text: "" });
                } else {
                    chrome.action.setBadgeText({ text: "OFF" });
                    chrome.action.setBadgeBackgroundColor({ color: "#FF5252" });
                }
                
                // Notify all tabs about the change
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(t => {
                        if (!t.url.startsWith('chrome://')) {
                            chrome.tabs.sendMessage(t.id, {
                                type: "extensionStateChanged",
                                enabled: newState
                            }).catch(err => console.log(`Error notifying tab ${t.id}:`, err));
                        }
                    });
                });
            });
        });
    }
});

// Listen for extension icon clicks to toggle the extension
chrome.action.onClicked.addListener((tab) => {
    // Toggle the extension state
    chrome.storage.local.get({ extensionEnabled: true }, (data) => {
        const newState = !data.extensionEnabled;
        chrome.storage.local.set({ extensionEnabled: newState }, () => {
            // Update context menu
            chrome.contextMenus.update("toggleExtension", {
                title: newState ? "Disable Translator" : "Enable Translator"
            });
            
            // Update badge
            if (newState) {
                chrome.action.setBadgeText({ text: "" });
            } else {
                chrome.action.setBadgeText({ text: "OFF" });
                chrome.action.setBadgeBackgroundColor({ color: "#FF5252" });
            }
            
            // Notify the current tab about the change
            if (!tab.url.startsWith('chrome://')) {
                chrome.tabs.sendMessage(tab.id, {
                    type: "extensionStateChanged",
                    enabled: newState
                }).catch(err => console.log("Error notifying tab:", err));
            }
        });
    });
});