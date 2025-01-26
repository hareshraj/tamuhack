async function fetchICalData(url) {
    console.log("Fetching iCal URL:", url); // Debugging
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch iCal: ${response.statusText}`);
        }

        const icalText = await response.text();
        console.log("Fetched iCal data:", icalText.substring(0, 500)); // Log partial content for debugging

        // Parse iCal data
        const parsedData = ICAL.parse(icalText);
        const comp = new ICAL.Component(parsedData);
        const events = comp.getAllSubcomponents("vevent");

        const assignments = events.map(event => {
            const vevent = new ICAL.Event(event);
            const summary = vevent.summary || "No Title";
            const classMatch = summary.match(/\[([A-Za-z]+)(?:[-\s]?(\d{3}))?/);
            const course = classMatch ? `${classMatch[1]} ${classMatch[2] || ""}`.trim() : "Unknown Course";
            const status = vevent.component.getFirstPropertyValue("status") || "Not Submitted";
            return {
                id: vevent.uid,
                title: summary,
                dueDate: vevent.startDate.toJSDate(),
                description: vevent.description || "No Description",
                link: vevent.component.getFirstPropertyValue("url") || "No Link",
                course: course,
                status: status
            };
        });

        console.log("Assignments parsed:", assignments); // Debug parsed assignments
        return assignments;
    } catch (error) {
        console.error("Error fetching/parsing iCal data:", error);
        return [];
    }
}

document.getElementById("save-url").addEventListener("click", async () => {
    const icalUrl = document.getElementById("ical-url").value;
    if (icalUrl) {
        chrome.storage.local.set({ icalUrl }, async () => {
            alert("iCal URL saved!");
            document.getElementById("ical-url").style.display = "none";
            document.getElementById("save-url").style.display = "none";
            document.querySelector("label[for='ical-url']").style.display = "none";
            await fetchAndDisplayAssignments(icalUrl); // Automatically fetch assignments after saving URL
        });
    } else {
        alert("Please enter a valid iCal URL.");
    }
});

document.getElementById("fetch").addEventListener("click", async () => {
    chrome.storage.local.get("icalUrl", async (data) => {
        if (data.icalUrl) {
            await fetchAndDisplayAssignments(data.icalUrl);
        } else {
            alert("Please save your iCal URL first!");
        }
    });
});

document.getElementById("open-calendar").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://canvas.tamu.edu/calendar#view_name=agenda" });
});

async function getAssignments() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["assignments"], (data) => {
            resolve(data.assignments || []);
        });
    });
}
  

async function fetchAndDisplayAssignments(icalUrl) {
    const assignmentList = document.getElementById("assignment-list");
    const pointsDisplay = document.getElementById("points-total");
    const rewardIconDisplay = document.getElementById("reward-icon");
    
    // Add null checks for critical elements
    if (!assignmentList || !pointsDisplay || !rewardIconDisplay) {
        if (!assignmentList) console.error("Assignment list element is missing.");
        if (!pointsDisplay) console.error("Points display element is missing.");
        if (!rewardIconDisplay) console.error("Reward icon display element is missing.");
        return; // Exit the function if critical elements are not found
    }
    
    assignmentList.innerHTML = "Fetching assignments...";

    const assignments = await fetchICalData(icalUrl);
    const now = new Date();

    const pastDueAssignments = assignments.filter(a => a.dueDate < now);
    const upcomingAssignments = assignments.filter(a => a.dueDate >= now);
    chrome.runtime.sendMessage(
        { action: "sendAssignments", assignments: assignments },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending assignments to background.js:", chrome.runtime.lastError.message);
            } else if (response && response.success) {
                console.log("Assignments sent successfully to background.js.");
            } else {
                console.error("Failed to send assignments.");
            }
        }
    );


    const courses = [...new Set(upcomingAssignments.map(a => a.course))];

    const formatDate = (date) => {
        return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    chrome.storage.local.get(["completedAssignments", "totalPoints", "pointsEarned"], (data) => {
        const completedAssignments = data.completedAssignments || [];
        const totalPoints = data.totalPoints || 0;
        const pointsEarnedData = data.pointsEarned || {};

        // Safely update points display and reward icon
        if (pointsDisplay) {
            pointsDisplay.textContent = `Total Points: ${totalPoints}`;
        }
        
        if (rewardIconDisplay) {
            rewardIconDisplay.src = getRewardIcon(totalPoints);
        }
        updateRewardIcon(totalPoints, rewardIconDisplay);

        assignmentList.innerHTML = `
            ${courses.map(course => `
                <details>
                    <summary>${course}</summary>
                    <ul>
                        ${upcomingAssignments.filter(a => a.course === course).map(a => `
                            <li>
                                <div class="assignment-header">
                                    <h3>${a.title.replace(/\[.*?\]/g, '').trim()}</h3>
                                    <a href="${a.link}" target="_blank" class="view-on-canvas">View on Canvas</a>
                                </div>
                                <div class="due">Due: ${formatDate(a.dueDate)}</div>
                                ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                                <div class="status">Status: ${completedAssignments.includes(a.id) ? "Completed" : a.status}</div>
                                <div class="points-earned">${pointsEarnedData[a.id] ? `+${pointsEarnedData[a.id]} points` : ''}</div>
                                <button class="toggle-completed" data-id="${a.id}" data-due="${a.dueDate.getTime()}">${completedAssignments.includes(a.id) ? "Unmark as Completed" : "Mark as Completed"}</button>
                            </li>
                        `).join('')}
                    </ul>
                </details>
            `).join('')}
            <details>
                <summary>Past Due Assignments</summary>
                <ul>
                    ${pastDueAssignments.map(a => `
                        <li>
                            <div class="assignment-header">
                                <h3>${a.title.replace(/\[.*?\]/g, '').trim()}</h3>
                                <a href="${a.link}" target="_blank" class="view-on-canvas">View on Canvas</a>
                            </div>
                            <div class="due">Due: ${formatDate(a.dueDate)}</div>
                            ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                            <div class="status">Status: ${completedAssignments.includes(a.id) ? "Completed" : a.status}</div>
                            <div class="points-earned">${pointsEarnedData[a.id] ? `+${pointsEarnedData[a.id]} points` : ''}</div>
                            <button class="toggle-completed" data-id="${a.id}" data-due="${a.dueDate.getTime()}">${completedAssignments.includes(a.id) ? "Unmark as Completed" : "Mark as Completed"}</button>
                        </li>
                    `).join('')}
                </ul>
            </details>
        `;

        document.querySelectorAll(".toggle-completed").forEach(button => {
            button.addEventListener("click", (event) => {
                const id = event.target.getAttribute("data-id");
                const dueDate = new Date(parseInt(event.target.getAttribute("data-due")));
                
                chrome.storage.local.get(["completedAssignments", "totalPoints", "pointsEarned"], (data) => {
                    const completedAssignments = data.completedAssignments || [];
                    let totalPoints = data.totalPoints || 0;
                    const pointsEarnedData = data.pointsEarned || {};

                    if (completedAssignments.includes(id)) {
                        // Unmark assignment as completed
                        totalPoints -= pointsEarnedData[id];
                        const index = completedAssignments.indexOf(id);
                        if (index > -1) {
                            completedAssignments.splice(index, 1);
                        }
                        delete pointsEarnedData[id];
                        
                        // Save data
                        chrome.storage.local.set({ 
                            completedAssignments, 
                            totalPoints,
                            pointsEarned: pointsEarnedData
                        }, () => {
                            // Update UI
                            event.target.previousElementSibling.previousElementSibling.textContent = "Status: Not Completed";
                            event.target.previousElementSibling.textContent = "";
                            event.target.textContent = "Mark as Completed";
                            
                            // Update total points and reward icon
                            document.getElementById('points-summary').innerHTML = `
                                <h2>Total Points: ${totalPoints}</h2>
                                <img id="reward-icon" src="${getRewardIcon(totalPoints)}" alt="Reward Status">
                            `;

                            // Update milestones
                            updateMilestones(totalPoints);
                        });
                    } else {
                        // Mark assignment as completed
                        const now = new Date();
                        const pointsEarned = calculatePoints(dueDate, now);
                        totalPoints += pointsEarned;
                        completedAssignments.push(id);
                        pointsEarnedData[id] = pointsEarned;
                        
                        // Save data
                        chrome.storage.local.set({ 
                            completedAssignments, 
                            totalPoints,
                            pointsEarned: pointsEarnedData
                        }, () => {
                            // Update UI
                            event.target.previousElementSibling.previousElementSibling.textContent = "Status: Completed";
                            event.target.previousElementSibling.textContent = `+${pointsEarned} points`;
                            event.target.textContent = "Unmark as Completed";
                            
                            // Update total points and reward icon
                            document.getElementById('points-summary').innerHTML = `
                                <h2>Total Points: ${totalPoints}</h2>
                                <img id="reward-icon" src="${getRewardIcon(totalPoints)}" alt="Reward Status">
                            `;

                            // Update milestones
                            updateMilestones(totalPoints);
                        });
                    }
                });
            });
        });
    });

    chrome.storage.local.set({ assignments, lastFetch: Date.now() });
}

function calculatePoints(dueDate, completionDate) {
    const timeDifference = completionDate - dueDate;
    
    if (timeDifference < 0) {
        // Early submission
        const daysEarly = Math.floor(-timeDifference / (1000 * 60 * 60 * 24));
        if (daysEarly === 0) return 5;  // Same day
        if (daysEarly === 1) return 10; // 1 day early
        if (daysEarly === 2) return 20; // 2 days early
        if (daysEarly === 3) return 30; // 3 days early
        if (daysEarly === 4) return 40; // 4 days early
        return 50; // 3+ days early
    } else if (timeDifference > 0) {
        // Late submission
        const daysLate = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        if (daysLate <= 1) return -25; // Late but within a day
        return -50; // More than a day late
    }
    return 0; // On-time submission
}

function getRewardIcon(points) {
    if (points >= 500) return 'icons/proudnate.png';
    if (points >= 250) return 'icons/thumbsupnate.png';
    if (points >= 0) return 'icons/angrynate.png';
    return 'icons/angrynate.png';
}

function updateRewardIcon(points, iconElement) {
    if (iconElement) {
        iconElement.src = getRewardIcon(points);
    }
}

function updateMilestones(points) {
    const milestonesList = document.querySelector('#milestones ul');
    if (milestonesList) {
        const milestones = milestonesList.querySelectorAll('li');
        milestones.forEach(milestone => {
            const pointsRequired = parseInt(milestone.textContent.split(':')[1]);
            if (points >= pointsRequired) {
                milestone.classList.add('completed');
            }
        });
    }
}

// Modify the initial load to reset points if needed (optional)
chrome.storage.local.get(["totalPoints"], (data) => {
    if (data.totalPoints === undefined) {
        chrome.storage.local.set({ totalPoints: 0 });
    }
});

// Check if iCal URL is already saved and hide input, button, and label if it is
chrome.storage.local.get("icalUrl", (data) => {
    if (data.icalUrl) {
        document.getElementById("ical-url").style.display = "none";
        document.getElementById("save-url").style.display = "none";
        document.querySelector("label[for='ical-url']").style.display = "none";
        fetchAndDisplayAssignments(data.icalUrl);
    }
});

// Auto-refresh assignments when the extension is opened
document.addEventListener("DOMContentLoaded", async () => {
    const assignments = await getAssignments(); // Function to fetch assignments
  
    const comprehendClient = await CredentialsManager.initializeAwsConfig();
    const analyzer = new AssignmentUrgencyAnalyzer(comprehendClient);
  
    const analyzedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const analysis = await analyzer.analyzeAssignmentUrgency(assignment);
        return {
          ...assignment,
          summary: analysis?.truncatedDescription || "No summary available",
          urgency: analysis?.urgencyScore || 0,
          sentiment: analysis?.sentimentSummary || "Unknown",
        };
      })
    );
  
    const container = document.getElementById("assignments");
  
    analyzedAssignments.forEach((a) => {
      const assignmentDiv = document.createElement("div");
      assignmentDiv.className = "assignment";
  
      const urgencyClass =
        a.urgency > 0.8
          ? "high-urgency"
          : a.urgency > 0.5
          ? "medium-urgency"
          : "low-urgency";
  
      assignmentDiv.innerHTML = `
        <div class="title">${a.title}</div>
        <div class="urgency ${urgencyClass}">Urgency: ${(a.urgency * 100).toFixed(
        1
      )}%</div>
        <div class="sentiment">Sentiment: ${a.sentiment}</div>
        ${
          a.summary !== "No summary available"
            ? `<div class="desc">${a.summary}</div>`
            : ""
        }
        <div class="due-date">Due: ${new Date(a.dueDate).toLocaleString()}</div>
      `;
  
      container.appendChild(assignmentDiv);
    });
  });
  

document.getElementById("save-url").addEventListener("click", async () => {
    const icalUrl = document.getElementById("ical-url").value;
    if (icalUrl) {
        chrome.storage.local.set({ icalUrl }, async () => {
            alert("iCal URL saved!");
            document.getElementById("ical-url").style.display = "none";
            document.getElementById("save-url").style.display = "none";
            document.querySelector("label[for='ical-url']").style.display = "none";
            await fetchAndDisplayAssignments(icalUrl);
        });
    } else {
        alert("Please enter a valid iCal URL.");
    }
});

// Display saved assignments when the extension is opened and check for updates if needed
chrome.storage.local.get(["assignments", "lastFetch", "icalUrl"], async (data) => {
    const assignmentList = document.getElementById("assignment-list");
    const now = new Date();
    const thirtyMinutes = 30 * 60 * 1000;

    if (data.assignments && data.assignments.length > 0 && (!data.lastFetch || (Date.now() - data.lastFetch <= thirtyMinutes))) {
        const pastDueAssignments = data.assignments.filter(a => new Date(a.dueDate) < now);
        const upcomingAssignments = data.assignments.filter(a => new Date(a.dueDate) >= now);

        const courses = [...new Set(upcomingAssignments.map(a => a.course))];

        const formatDate = (date) => {
            return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        chrome.storage.local.get("completedAssignments", (data) => {
            const completedAssignments = data.completedAssignments || [];

            assignmentList.innerHTML = `
                ${courses.map(course => `
                    <details>
                        <summary>${course}</summary>
                        <ul>
                            ${upcomingAssignments.filter(a => a.course === course).map(a => `
                                <li>
                                    <div class="assignment-header">
                                        <h3>${a.title.replace(/\[.*?\]/g, '').trim()}</h3>
                                        <a href="${a.link}" target="_blank" class="view-on-canvas">View on Canvas</a>
                                    </div>
                                    <div class="due">Due: ${formatDate(new Date(a.dueDate))}</div>
                                    ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                                    <div class="status">Status: ${completedAssignments.includes(a.id) ? "Completed" : a.status}</div>
                                    <button class="toggle-completed" data-id="${a.id}" data-due="${a.dueDate.getTime()}">${completedAssignments.includes(a.id) ? "Unmark as Completed" : "Mark as Completed"}</button>
                                </li>
                            `).join('')}
                        </ul>
                    </details>
                `).join('')}
                <details>
                    <summary>Past Due Assignments</summary>
                    <ul>
                        ${pastDueAssignments.map(a => `
                            <li>
                                <div class="assignment-header">
                                    <h3>${a.title.replace(/\[.*?\]/g, '').trim()}</h3>
                                    <a href="${a.link}" target="_blank" class="view-on-canvas">View on Canvas</a>
                                </div>
                                <div class="due">Due: ${formatDate(new Date(a.dueDate))}</div>
                                ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                                <div class="status">Status: ${completedAssignments.includes(a.id) ? "Completed" : a.status}</div>
                                <button class="toggle-completed" data-id="${a.id}" data-due="${a.dueDate.getTime()}">${completedAssignments.includes(a.id) ? "Unmark as Completed" : "Mark as Completed"}</button>
                            </li>
                        `).join('')}
                    </ul>
                </details>
            `;
        });
    }

    if (!data.lastFetch || (Date.now() - data.lastFetch > thirtyMinutes)) {
        if (data.icalUrl) {
            await fetchAndDisplayAssignments(data.icalUrl); // Fetch assignments if more than 30 minutes have passed
        }
    }
});