document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("icalUrl", (data) => {
    if (data.icalUrl) {
      document.getElementById("ical-url").value = data.icalUrl;
    }
  });

  document.getElementById("save-url").addEventListener("click", () => {
    const icalUrl = document.getElementById("ical-url").value;
    chrome.storage.local.set({ icalUrl }, () => {
      alert("iCal URL saved!");
    });
  });

  document.getElementById("back-button").addEventListener("click", () => {
    window.location.href = "popup.html";
  });
});
