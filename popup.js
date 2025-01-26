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
              status: status === "COMPLETED" ? "Submitted" : "Not Submitted"
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

document.getElementById("open-settings").addEventListener("click", () => {
  window.location.href = "settings.html";
});

async function fetchAndDisplayAssignments(icalUrl) {
  const assignmentList = document.getElementById("assignment-list");
  assignmentList.innerHTML = "Fetching assignments...";

  const assignments = await fetchICalData(icalUrl);
  const now = new Date();

  const pastDueAssignments = assignments.filter(a => a.dueDate < now);
  const upcomingAssignments = assignments.filter(a => a.dueDate >= now);

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
                  <a href="${a.link}" target="_blank" class="view-on-canvas">
                    <img src="./images/CanvasLogo.svg" alt="View on Canvas">
                  </a>
                </div>
                <div class="due">Due: ${formatDate(a.dueDate)}</div>
                ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                <div class="status">Status: ${completedAssignments.includes(a.id) ? "Submitted" : "Not Submitted"}</div>
                <button class="mark-completed" data-id="${a.id}">${completedAssignments.includes(a.id) ? "Mark as Not Submitted" : "Mark as Submitted"}</button>
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
                <a href="${a.link}" target="_blank" class="view-on-canvas">
                  <img src="./images/CanvasLogo.svg" alt="View on Canvas">
                </a>
              </div>
              <div class="due">Due: ${formatDate(a.dueDate)}</div>
              ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
              <div class="status">Status: ${completedAssignments.includes(a.id) ? "Submitted" : "Not Submitted"}</div>
              <button class="mark-completed" data-id="${a.id}">${completedAssignments.includes(a.id) ? "Mark as Not Submitted" : "Mark as Submitted"}</button>
            </li>
          `).join('')}
        </ul>
      </details>
    `;

    document.querySelectorAll(".mark-completed").forEach(button => {
      button.addEventListener("click", (event) => {
        const id = event.target.getAttribute("data-id");
        chrome.storage.local.get("completedAssignments", (data) => {
          let completedAssignments = data.completedAssignments || [];
          if (completedAssignments.includes(id)) {
            completedAssignments = completedAssignments.filter(aid => aid !== id);
            event.target.textContent = "Mark as Submitted";
            event.target.previousElementSibling.textContent = "Status: Not Submitted";
          } else {
            completedAssignments.push(id);
            event.target.textContent = "Mark as Not Submitted";
            event.target.previousElementSibling.textContent = "Status: Submitted";
          }
          chrome.storage.local.set({ completedAssignments });
        });
      });
    });
  });

  chrome.storage.local.set({ assignments, lastFetch: Date.now() }); // Save assignments and timestamp
}

// Check if iCal URL is already saved and hide input, button, and label if it is
chrome.storage.local.get("icalUrl", (data) => {
  if (data.icalUrl) {
      document.getElementById("ical-url").style.display = "none";
      document.getElementById("save-url").style.display = "none";
      document.querySelector("label[for='ical-url']").style.display = "none";
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
                      <a href="${a.link}" target="_blank" class="view-on-canvas">
                        <img src="./images/CanvasLogo.svg" alt="View on Canvas">
                      </a>
                    </div>
                    <div class="due">Due: ${formatDate(new Date(a.dueDate))}</div>
                    ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                    <div class="status">Status: ${completedAssignments.includes(a.id) ? "Submitted" : "Not Submitted"}</div>
                    <button class="mark-completed" data-id="${a.id}">${completedAssignments.includes(a.id) ? "Mark as Not Submitted" : "Mark as Submitted"}</button>
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
                    <a href="${a.link}" target="_blank" class="view-on-canvas">
                      <img src="./images/CanvasLogo.svg" alt="View on Canvas">
                    </a>
                  </div>
                  <div class="due">Due: ${formatDate(new Date(a.dueDate))}</div>
                  ${a.description !== "No Description" ? `<div class="desc">${a.description}</div>` : ""}
                  <div class="status">Status: ${completedAssignments.includes(a.id) ? "Submitted" : a.status}</div>
                  <button class="mark-completed" data-id="${a.id}">${completedAssignments.includes(a.id) ? "Mark as Not Submitted" : "Mark as Submitted"}</button>
                </li>
              `).join('')}
            </ul>
          </details>
        `;

        document.querySelectorAll(".mark-completed").forEach(button => {
          button.addEventListener("click", (event) => {
            const id = event.target.getAttribute("data-id");
            chrome.storage.local.get("completedAssignments", (data) => {
              let completedAssignments = data.completedAssignments || [];
              if (completedAssignments.includes(id)) {
                completedAssignments = completedAssignments.filter(aid => aid !== id);
                event.target.textContent = "Mark as Submitted";
                event.target.previousElementSibling.textContent = "Status: Not Submitted";
              } else {
                completedAssignments.push(id);
                event.target.textContent = "Mark as Not Submitted";
                event.target.previousElementSibling.textContent = "Status: Submitted";
              }
              chrome.storage.local.set({ completedAssignments });
            });
          });
        });
      });
  }

  if (!data.lastFetch || (Date.now() - data.lastFetch > thirtyMinutes)) {
      if (data.icalUrl) {
          await fetchAndDisplayAssignments(data.icalUrl); // Fetch assignments if more than 30 minutes have passed
      }
  }
});

// Auto-refresh assignments when the extension is opened
document.addEventListener("DOMContentLoaded", async () => {
  chrome.storage.local.get("icalUrl", async (data) => {
    if (data.icalUrl) {
      await fetchAndDisplayAssignments(data.icalUrl);
    }
  });

  document.querySelectorAll("details summary").forEach(summary => {
    summary.classList.add("editable-title");
    summary.addEventListener("dblclick", (event) => {
      const target = event.target;
      target.setAttribute("contenteditable", "true");
      target.focus();
    });

    summary.addEventListener("blur", (event) => {
      const target = event.target;
      target.removeAttribute("contenteditable");
      // Optionally, save the new title to storage or handle it as needed
    });
  });

  const contextMenu = document.createElement("div");
  contextMenu.classList.add("context-menu");
  contextMenu.innerHTML = '<div class="context-menu__item">Rename</div>';
  document.body.appendChild(contextMenu);

  document.querySelectorAll("details summary").forEach(summary => {
    summary.classList.add("editable-title");

    summary.addEventListener("dblclick", (event) => {
      const target = event.target;
      target.setAttribute("contenteditable", "true");
      target.focus();
    });

    summary.addEventListener("blur", (event) => {
      const target = event.target;
      target.removeAttribute("contenteditable");
      // Optionally, save the new title to storage or handle it as needed
    });

    summary.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.display = "block";
      contextMenu.targetElement = event.target;
    });
  });

  document.addEventListener("click", () => {
    contextMenu.style.display = "none";
  });

  contextMenu.querySelector(".context-menu__item").addEventListener("click", () => {
    const target = contextMenu.targetElement;
    if (target) {
      target.setAttribute("contenteditable", "true");
      target.focus();
    }
    contextMenu.style.display = "none";
  });
});
