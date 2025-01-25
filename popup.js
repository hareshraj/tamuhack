document.getElementById("fetch").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "fetchAssignments" }, (response) => {
      console.log("Assignments fetched:", response);
    });
  });
  