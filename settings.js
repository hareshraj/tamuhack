document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("icalUrl", (data) => {
    if (data.icalUrl) {
      document.getElementById("ical-url").value = data.icalUrl;
    }
  });

  document.getElementById("save-url").addEventListener("click", () => {
    const icalUrl = document.getElementById("ical-url").value;
    const urlPattern = /^https?:\/\/.*\.ics$/i; // Regex pattern to validate iCal URL
    if (icalUrl && urlPattern.test(icalUrl)) {
      chrome.storage.local.set({ icalUrl });
    } else {
      alert("Please enter a valid iCal URL ending with .ics.");
    }
  });

  document.getElementById("back-button").addEventListener("click", () => {
    window.location.href = "popup.html";
  });

  document.getElementById("show-welcome").addEventListener("click", () => {
    window.location.href = "welcome.html";
  });

  // Remove course title edit functionality
});
