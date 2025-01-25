chrome.runtime.onInstalled.addListener(() => {
    console.log("ProcrastiNator installed!");
  
    // Set up a recurring alarm to check Canvas deadlines
    chrome.alarms.create("checkCanvas", { periodInMinutes: 10 });
  });
  
  // Alarm listener to fetch and process Canvas tasks
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkCanvas") {
      console.log("Checking Canvas deadlines...");
      // Call your API fetch function or content script here
    }
  });
  
  // Handle notifications
  chrome.notifications.onClicked.addListener((notificationId) => {
    console.log(`Notification ${notificationId} clicked!`);
  });  