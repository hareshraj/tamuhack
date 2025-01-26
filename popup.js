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
          return {
              title: vevent.summary || "No Title",
              dueDate: vevent.startDate.toJSDate().toLocaleString(),
              description: vevent.description || "No Description",
              link: vevent.component.getFirstPropertyValue("url") || "No Link"
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

async function fetchAndDisplayAssignments(icalUrl) {
  const assignmentList = document.getElementById("assignment-list");
  assignmentList.innerHTML = "Fetching assignments...";

  const assignments = await fetchICalData(icalUrl);
  if (assignments.length > 0) {
      assignmentList.innerHTML = assignments.map(a => `
          <li>
              <h3>${a.title}</h3>
              <div class="due">Due: ${a.dueDate}</div>
              <div class="desc">${a.description}</div>
              <a href="${a.link}" target="_blank">View on Canvas</a>
          </li>
      `).join('');
      chrome.storage.local.set({ assignments, lastFetch: Date.now() }); // Save assignments and timestamp
  } else {
      assignmentList.innerHTML = "<li>No assignments found</li>";
  }
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
  if (data.assignments && data.assignments.length > 0) {
      assignmentList.innerHTML = data.assignments.map(a => `
          <li>
              <h3>${a.title}</h3>
              <div class="due">Due: ${a.dueDate}</div>
              <div class="desc">${a.description}</div>
              <a href="${a.link}" target="_blank">View on Canvas</a>
          </li>
      `).join('');
  }

  const thirtyMinutes = 30 * 60 * 1000;
  if (data.lastFetch && (Date.now() - data.lastFetch > thirtyMinutes) && data.icalUrl) {
      await fetchAndDisplayAssignments(data.icalUrl); // Fetch assignments if more than 30 minutes have passed
  }
});
