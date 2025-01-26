document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("welcomeShown", (data) => {
    document.getElementById("dont-show-again").checked = data.welcomeShown || false;
  });

  document.getElementById("next-button").addEventListener("click", () => {
    const dontShowAgain = document.getElementById("dont-show-again").checked;
    chrome.storage.local.set({ welcomeShown: dontShowAgain }, () => {
      window.location.href = "popup.html";
    });
  });

  document.getElementById("open-calendar").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://canvas.tamu.edu/calendar#view_name=agenda" });
  });
});
