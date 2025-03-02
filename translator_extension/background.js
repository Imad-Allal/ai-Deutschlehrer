chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "translate") {
        console.log("Background received request:", request);

        fetch("http://127.0.0.1:5000/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                word: request.word,
                sentence: request.sentence,
                index: request.index
            })
        })
            .then(response => {
                console.log("API response received:", response);
                return response.json();
            })
            .then(data => {
                console.log("Translation data:", data);
                // Save to storage
                chrome.storage.local.set({ translation: data.translation });

                // Send back to the content script
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: "showTranslation",
                    translation: data.translation
                });

                // Send response to sendResponse
                sendResponse({ success: true, translation: data.translation });
            })
            .catch(error => {
                console.error("API Error:", error);
                sendResponse({ success: false, error: error.toString() });
            });

        return true; // Keep the message channel open for async response
    }
});