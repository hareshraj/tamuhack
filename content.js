function scrapeAssignments() {
    const assignments = [];
    const assignmentItems = document.querySelectorAll(".fc-event");

    assignmentItems.forEach((item) => {
        const titleElement = item.querySelector(".agenda-event__title");
        const dueTimeElement = item.querySelector(".agenda-event__time");
        const statusElements = item.querySelectorAll(".screenreader-only");

        const title = titleElement ? titleElement.textContent.trim() : "Unknown Title";
        const dueTime = dueTimeElement ? dueTimeElement.textContent.trim() : "No Due Time";
        
        const statusElement = Array.from(statusElements).find(el => 
            el.textContent.match(/completed|not completed/i)
        );
        const status = statusElement ? statusElement.textContent.trim() : "Status Unknown";

        const courseElement = Array.from(statusElements).find(el => 
            el.textContent.includes("Calendar")
        );
        const course = courseElement 
            ? courseElement.textContent.replace("Calendar", "").trim() 
            : "Unknown Course";

        assignments.push({ title, dueTime, status, course });
    });

    return assignments;
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getAssignments") {
        const assignments = scrapeAssignments();
        sendResponse({ assignments });
        return true;
    }
});

// Ensure the script runs on the specified URL
if (window.location.href.includes("canvas.tamu.edu/calendar#view_name=agenda")) {
    scrapeAssignments();
}