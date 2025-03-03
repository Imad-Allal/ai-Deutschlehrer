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
    }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        // Notify content script that page is fully loaded
        chrome.tabs.sendMessage(tabId, { type: "pageFullyLoaded" })
            .catch(err => console.log("Error sending pageFullyLoaded message:", err));
    }
});

// Create a context menu item
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "refreshHighlights",
        title: "Refresh Translation View",
        contexts: ["page"]
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
    }
}); 