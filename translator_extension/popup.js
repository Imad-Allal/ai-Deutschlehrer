document.addEventListener("DOMContentLoaded", () => {
    const savedWordsList = document.getElementById("savedWordsList");
    const emptyState = document.getElementById("emptyState");
    const wordCount = document.getElementById("wordCount");
    const searchInput = document.getElementById("searchInput");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const highlightColorSelect = document.getElementById("highlightColor");
    const exportBtn = document.getElementById("exportBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");

    // Load saved highlight color
    chrome.storage.local.get({ highlightColor: "#ffde59" }, (data) => {
        highlightColorSelect.value = data.highlightColor;
    });

    // Save highlight color when changed
    highlightColorSelect.addEventListener("change", function () {
        const color = this.value;
        chrome.storage.local.set({ highlightColor: color });

        // Update highlight color in content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "updateHighlightColor",
                    color: color
                }).catch(err => console.log("Error updating highlight color:", err));
            }
        });
    });

    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const tabName = button.getAttribute("data-tab");

            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            // Show selected tab content
            tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.id === `${tabName}-tab`) {
                    content.classList.add("active");
                }
            });
        });
    });

    // Export functionality
    exportBtn.addEventListener("click", () => {
        chrome.storage.local.get({ savedTranslations: [] }, (data) => {
            if (data.savedTranslations.length === 0) {
                alert("No words to export.");
                return;
            }

            // Create CSV content
            let csvContent = "Word,Translation,Context,URL\n";
            data.savedTranslations.forEach(item => {
                // Properly escape fields for CSV
                const word = `"${item.word.replace(/"/g, '""')}"`;
                const translation = `"${item.translation.replace(/"/g, '""')}"`;
                const context = `"${item.context.replace(/"/g, '""')}"`;
                const url = `"${item.url.replace(/"/g, '""')}"`;

                csvContent += `${word},${translation},${context},${url}\n`;
            });

            // Create and trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "translations.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });

    // Clear all data functionality
    clearAllBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all saved words? This cannot be undone.")) {
            chrome.storage.local.set({ savedTranslations: [], pageHighlights: {} }, () => {
                loadSavedWords();
            });
        }
    });

    // Search functionality
    searchInput.addEventListener("input", () => {
        const searchTerm = searchInput.value.toLowerCase();
        filterWords(searchTerm);
    });

    function filterWords(searchTerm) {
        const items = savedWordsList.querySelectorAll("li");
        let visibleCount = 0;

        items.forEach(item => {
            const word = item.querySelector(".word").textContent.toLowerCase();
            const translation = item.querySelector(".translation").textContent.toLowerCase();
            const context = item.querySelector(".context").textContent.toLowerCase();

            if (word.includes(searchTerm) || translation.includes(searchTerm) || context.includes(searchTerm)) {
                item.style.display = "";
                visibleCount++;
            } else {
                item.style.display = "none";
            }
        });

        // Show/hide empty state based on search results
        if (visibleCount === 0 && items.length > 0) {
            emptyState.style.display = "flex";
            emptyState.querySelector("p").textContent = "No matching words found";
            emptyState.querySelector("small").textContent = "Try a different search term";
        } else {
            emptyState.style.display = items.length === 0 ? "flex" : "none";
            emptyState.querySelector("p").textContent = "No saved words yet";
            emptyState.querySelector("small").textContent = "Highlight text on any webpage and click \"Translate\" to add words";
        }
    }

    function loadSavedWords() {
        chrome.storage.local.get({ savedTranslations: [] }, (data) => {
            const translations = data.savedTranslations;

            // Update word count
            wordCount.textContent = translations.length;

            // Clear the list
            savedWordsList.innerHTML = "";

            if (translations.length === 0) {
                emptyState.style.display = "flex";
                return;
            }

            emptyState.style.display = "none";

            // Sort translations by most recent first (assuming there's a timestamp)
            const sortedTranslations = [...translations].reverse();

            sortedTranslations.forEach((item, index) => {
                const originalIndex = translations.length - 1 - index;
                const li = document.createElement("li");

                // Truncate context if it's too long
                const maxContextLength = 100;
                let displayContext = item.context || "";
                if (displayContext.length > maxContextLength) {
                    displayContext = displayContext.substring(0, maxContextLength) + "...";
                }

                // Get hostname from URL for cleaner display
                let hostname = "";
                try {
                    hostname = new URL(item.url).hostname;
                } catch (e) {
                    hostname = item.url;
                }

                li.innerHTML = `
                    <div class="word-container">
                        <div>
                            <div class="word">${item.word}</div>
                            <div class="translation">${item.translation}</div>
                        </div>
                        <div class="action-buttons">
                            <button class="delete-btn" data-index="${originalIndex}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="context">${displayContext}</div>
                    <div class="meta">
                        <a href="${item.url}" target="_blank" class="source-link">
                            <i class="fas fa-external-link-alt"></i> ${hostname}
                        </a>
                    </div>
                `;
                savedWordsList.appendChild(li);
            });

            // Add event listeners to delete buttons
            document.querySelectorAll(".delete-btn").forEach(button => {
                button.addEventListener("click", function () {
                    const index = parseInt(this.getAttribute("data-index"));
                    removeSavedWord(index);
                });
            });
        });
    }

    // Function to remove a saved word
    function removeSavedWord(index) {
        chrome.storage.local.get({ savedTranslations: [] }, (data) => {
            let translations = data.savedTranslations;
            const wordToRemove = translations[index].word.toLowerCase();

            // Remove from savedTranslations
            translations.splice(index, 1);

            // Also remove from pageHighlights if present
            chrome.storage.local.get({ pageHighlights: {} }, (result) => {
                let pageHighlights = result.pageHighlights;

                // Loop through all URLs in pageHighlights
                Object.keys(pageHighlights).forEach(url => {
                    pageHighlights[url] = pageHighlights[url].filter(h =>
                        h.word.toLowerCase() !== wordToRemove
                    );

                    // Remove empty URL entries
                    if (pageHighlights[url].length === 0) {
                        delete pageHighlights[url];
                    }
                });

                // Save both updated objects
                chrome.storage.local.set({
                    savedTranslations: translations,
                    pageHighlights: pageHighlights
                }, () => {
                    // Refresh the display
                    loadSavedWords();

                    // Notify content script to remove highlight
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: "removeHighlight",
                                word: wordToRemove
                            }).catch(err => console.log("Error sending removeHighlight message:", err));
                        }
                    });
                });
            });
        });
    }

    // Initial load
    loadSavedWords();
});