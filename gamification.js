// gamification.js
class AssignmentGameManager {
    constructor() {
        // Points system configuration
        this.config = {
            earlySubmissionPoints: 10,    // Points for submitting early
            onTimeSubmissionPoints: 5,   // Points for submitting on time
            lateSubmissionPenalty: -50,   // Points deducted for late submissions
            missingAssignmentPenalty: -100 // Points deducted for missing assignments
        };

        // Mascot states
        this.mascotStates = {
            happy: "🐱😄",    // Super happy for early submissions
            neutral: "🐱😐",   // Neutral for on-time submissions
            worried: "🐱😟",   // Worried for late submissions
            sad: "🐱😢"        // Very sad for missed assignments
        };

        // Initialize or load player stats
        this.initializePlayerStats();
    }

    initializePlayerStats() {
        chrome.storage.local.get(['playerStats'], (result) => {
            if (!result.playerStats) {
                // First-time setup
                const initialStats = {
                    totalPoints: 0,
                    assignmentsCompleted: 0,
                    assignmentsLate: 0,
                    assignmentsMissed: 0,
                    currentLevel: 1,
                    rewards: []
                };
                chrome.storage.local.set({ playerStats: initialStats });
            }
        });
    }

    async evaluateAssignment(assignment) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        
        const dueDate = new Date(assignment.dueDate);
        console.log(`Assignment Due Date: ${assignment.dueDate}`);
        console.log(`Normalized Due Date: ${dueDate}`);
        dueDate.setHours(0, 0, 0, 0); // Normalize due date time
        
        // Only consider assignments from today onwards
        if (dueDate < today) return { pointsEarned: 0, mascotState: this.mascotStates.sad }; // No points if the assignment is in the past
    
        let pointsEarned = 0;
        let mascotState = this.mascotStates.neutral;
    
        const daysDifference = Math.ceil((dueDate - today) / (1000 * 3600 * 24));
    
        console.log(`Assignment: ${assignment.title}`);
        console.log(`Due Date: ${dueDate}`);
        console.log(`Today: ${today}`);
        console.log(`Days Difference: ${daysDifference}`);
    
        if (assignment.status === "completed") {
            if (daysDifference === 0) {
                // Completed on time
                pointsEarned = this.config.onTimeSubmissionPoints;  // Points for on-time submission
                mascotState = this.mascotStates.neutral;
                console.log('On-time submission - 5 points');
            } else if (daysDifference === 1) {
                // Submitted 1 day early
                pointsEarned = this.config.earlySubmissionPoints;  // Extra points for early submission
                mascotState = this.mascotStates.happy;
                console.log('1 day early submission - 10 points');
            } else if (daysDifference > 1) {
                // More than 1 day early
                pointsEarned = this.config.earlySubmissionPoints * daysDifference;  // Scale points for multiple days early
                mascotState = this.mascotStates.happy;
                console.log(`${daysDifference} days early submission - ${pointsEarned} points`);
            } else if (daysDifference < 0) {
                // Late submission
                pointsEarned = this.config.lateSubmissionPenalty;  // Penalty for late submission
                mascotState = this.mascotStates.worried;
                console.log('Late submission - penalty');
            }
        }
    
        // Update player stats
        await this.updatePlayerStats(pointsEarned);
    
        return {
            pointsEarned,
            mascotState
        };
    }
    
    
    // Simplified update method
    async updatePlayerStats(points) {
        const playerStats = await this.getPlayerStats();
    
        if (points === 5) {
            playerStats.assignmentsCompleted++;
            playerStats.totalPoints += 5;
        } else if (points > 5) { 
            playerStats.assignmentsCompleted++;
            playerStats.totalPoints += points;
        }
    
        // Recalculate level based on total points
        playerStats.currentLevel = Math.floor(playerStats.totalPoints / 100) + 1;
    
        // Save updated stats
        chrome.storage.local.set({ playerStats });
    }
    
    

    async getPlayerStats() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['playerStats'], (result) => {
                resolve(result.playerStats);
            });
        });
    }

    checkAndAddRewards(playerStats) {
        const possibleRewards = [
            { 
                name: "Productivity Wizard", 
                description: "Complete 10 assignments on time", 
                condition: () => playerStats.assignmentsCompleted >= 10 
            },
            { 
                name: "Early Bird Badge", 
                description: "Submit 5 assignments early", 
                condition: () => playerStats.assignmentsCompleted >= 5 
            },
            { 
                name: "Point Accumulator", 
                description: "Reach 1000 total points", 
                condition: () => playerStats.totalPoints >= 1000 
            }
        ];

        possibleRewards.forEach(reward => {
            if (reward.condition() && 
                !playerStats.rewards.some(r => r.name === reward.name)) {
                playerStats.rewards.push(reward);
            }
        });
    }

    // Method to generate motivational message based on performance
    generateMotivationalMessage(playerStats) {
        const messages = {
            default: "Keep pushing forward! Every assignment is a step towards success.",
            wellDone: "Wow! You're crushing it! Keep up the awesome work!",
            needImprovement: "Don't worry, every missed assignment is a learning opportunity."
        };

        if (playerStats.assignmentsMissed > playerStats.assignmentsCompleted) {
            return messages.needImprovement;
        } else if (playerStats.totalPoints > 1000) {
            return messages.wellDone;
        }

        return messages.default;
    }
}

// Instantiate the game manager
const gameManager = new AssignmentGameManager();

// Modify existing assignment processing to include gamification
async function processAssignments(assignments) {
    const gamifiedAssignments = [];

    for (const assignment of assignments) {
        const gameResult = await gameManager.evaluateAssignment(assignment);
        
        // Attach game results to assignment
        const gamifiedAssignment = {
            ...assignment,
            pointsEarned: gameResult.pointsEarned,
            mascotState: gameResult.mascotState
        };

        gamifiedAssignments.push(gamifiedAssignment);
    }

    // Update UI with gamification results
    updateAssignmentUI(gamifiedAssignments);
}

function updateAssignmentUI(gamifiedAssignments) {
    const assignmentList = document.getElementById("assignment-list");
    if (assignmentList) {
        assignmentList.innerHTML = gamifiedAssignments.map(a => `
            <li>
                <h3>${a.title} ${a.mascotState}</h3>
                <div class="points">${a.pointsEarned > 0 ? `+${a.pointsEarned} points` : 'No points earned'}</div>
                <div class="due">Due: ${a.dueDate}</div>
                <div class="desc">${a.description || 'No Description'}</div>
                <a href="${a.link}" target="_blank">View on Canvas</a>
            </li>
        `).join('');
    } else {
        console.log("No assignment list element found in the DOM.");
    }    

    // Optional: Display overall player stats
    displayPlayerStats();
}

async function displayPlayerStats() {
    const playerStats = await gameManager.getPlayerStats();
    const statsContainer = document.getElementById("player-stats");
    
    if (statsContainer) {
        statsContainer.innerHTML = `
            <h2>Your Progress 🏆</h2>
            <p>Total Points: ${playerStats.totalPoints}</p>
            <p>Level: ${playerStats.currentLevel}</p>
            <p>Assignments Completed: ${playerStats.assignmentsCompleted}</p>
            <p>Assignments Late: ${playerStats.assignmentsLate}</p>
            <p>Assignments Missed: ${playerStats.assignmentsMissed}</p>
            <h3>Rewards Earned</h3>
            <ul>
                ${playerStats.rewards.map(r => `<li>${r.name}: ${r.description}</li>`).join('')}
            </ul>
            <p>${gameManager.generateMotivationalMessage(playerStats)}</p>
        `;
    }
}

// Export functions if needed for other scripts
export { gameManager, processAssignments, displayPlayerStats };