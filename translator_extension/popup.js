document.addEventListener("DOMContentLoaded", () => {
    // Get and display the current translation
    chrome.storage.local.get("translation", (data) => {
        const translationElem = document.getElementById("translation");
        if (data.translation) {
            translationElem.innerText = data.translation;
        } else {
            translationElem.innerText = "No translation available. Select text on a page and click Translate.";
        }
    });

    // Listen for changes to the translation
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.translation) {
            document.getElementById("translation").innerText = changes.translation.newValue;
        }
    });
});