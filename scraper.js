chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'scrapeAssignments') {
      let assignments = [];
      let assignmentElements = document.querySelectorAll('.assignment-name'); // Adjust this selector based on Canvas' structure
      
      assignmentElements.forEach(element => {
        let assignmentName = element.textContent.trim();
        let dueDate = element.nextElementSibling.textContent.trim(); // Adjust if due date is next to the assignment name
        
        assignments.push({ name: assignmentName, dueDate: dueDate });
      });
  
      sendResponse({ assignments: assignments });
    }
  });
  