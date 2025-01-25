console.log("Content script running...");

// Scrape assignment data from Canvas page
const getAssignments = () => {
  const assignments = [];
  document.querySelectorAll(".assignment").forEach((assignment) => {
    const title = assignment.querySelector(".title").innerText;
    const dueDate = assignment.querySelector(".due-date").innerText;
    assignments.push({ title, dueDate });
  });
  console.log("Assignments found:", assignments);
  return assignments;
};

// Run the scraper when the page loads
window.addEventListener("load", () => {
  getAssignments();
});
