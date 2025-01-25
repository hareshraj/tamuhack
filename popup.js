document.getElementById("fetch").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "fetchAssignments" }, (response) => {
      console.log("Assignments fetched:", response);
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
