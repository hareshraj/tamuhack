//popup.js
document.getElementById("fetch").addEventListener("click", () => {
    const assignmentList = document.getElementById("assignment-list");
    assignmentList.innerHTML = "Fetching assignments...";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab.url && tab.url.includes("canvas")) {
            chrome.tabs.sendMessage(tab.id, { action: "getAssignments" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    assignmentList.innerHTML = "<li>Error fetching assignments</li>";
                    return;
                }
                
                if (response && response.assignments && response.assignments.length > 0) {
                    assignmentList.innerHTML = response.assignments.map(assignment => `
                        <li>
                            <h3>${assignment.title}</h3>
                            <div class="due">Due: ${assignment.dueTime}</div>
                            <div class="due">Course: ${assignment.course}</div>
                            <div class="due">Status: ${assignment.status}</div>
                        </li>
                    `).join('');
                } else {
                    assignmentList.innerHTML = "<li>No assignments found</li>";
                }
            });
        } else {
            assignmentList.innerHTML = "<li>Open a Canvas page first</li>";
        }
      displayAssignments(response.assignments);
    });
});

document.getElementById("open-calendar").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://canvas.tamu.edu/calendar#view_name=agenda&view_start=2025-01-25" });
});

function displayAssignments(assignments) {
    const assignmentList = document.getElementById("assignment-list");
    assignmentList.innerHTML = ""; // Clear any existing assignments
    assignments.forEach(assignment => {
        const listItem = document.createElement("li");
        listItem.textContent = `${assignment.name} - Due: ${assignment.dueDate}`;
        assignmentList.appendChild(listItem);
    });
}
