import { ComprehendClient, DetectSentimentCommand, DetectKeyPhrasesCommand } from "@aws-sdk/client-comprehend";

class CredentialsManager {
    static async getCredentials() {
      // Use AWS credential providers or your preferred method
      return {
        accessKeyId: '',
        secretAccessKey: '',
      };
    }
  
    static async initializeAwsConfig() {
      try {
        const credentials = await this.getCredentials();
        const client = new ComprehendClient({
          region: "us-east-1",
          credentials,
        });
        return client;
      } catch (error) {
        console.error("Error initializing AWS Comprehend client:", error.message);
        throw new Error("AWS initialization failed. Check your credentials or config.");
      }
    }
  }
  

// Deadline Insult Generator
const DEADLINE_INSULTS = [
  "Procrastination is your superpower, and not in a good way!",
  "Your assignment is about to ghost you harder than a bad Tinder date.",
  "Tick tock! This deadline is judging you harder than your parents.",
  "Looks like you're playing chicken with academic disaster again.",
  "Your future self is about to write a strongly worded letter to present you.",
  "This deadline is closer than your impending existential crisis.",
  "Warning: Academic apocalypse incoming in T-minus your typical procrastination time!",
  "Your assignment is throwing more shade than a tropical rainforest.",
  "Congratulations! You've reached Olympic-level deadline dodging.",
  "This due date is about to roast you harder than a stand-up comedian."
];

class AssignmentUrgencyAnalyzer {
  constructor(comprehendClient) {
    this.comprehendClient = comprehendClient;
  }

  async analyzeAssignmentUrgency(assignment) {
    try {
        const sentimentParams = {
            Text: assignment.description || assignment.title,
            LanguageCode: 'en'
        };

        const sentimentCommand = new DetectSentimentCommand(sentimentParams);
        const keyPhrasesCommand = new DetectKeyPhrasesCommand(sentimentParams);

        const handlePromise = async (promise) => {
            try {
              return await promise;
            } catch (error) {
              console.error("Error in Comprehend API call:", error.message);
              return null; // Return a default or null value on failure
            }
          };
      
          const [sentimentResult, keyPhrasesResult] = await Promise.all([
            handlePromise(this.comprehendClient.send(sentimentCommand)),
            handlePromise(this.comprehendClient.send(keyPhrasesCommand)),
          ]);
      
          // Check if either result is null
          if (!sentimentResult || !keyPhrasesResult) {
            console.warn("Skipping analysis due to API failure.");
            return null;
          }

        const summarizedDescription = this.summarizeDescription(
            keyPhrasesResult.KeyPhrases,
            assignment.description
        );    

      const urgencyFactors = {
        sentiment: this.getSentimentUrgencyMultiplier(sentimentResult.Sentiment),
        keyPhrases: this.calculateKeyPhraseUrgency(keyPhrasesResult.KeyPhrases),
        timeRemaining: this.calculateTimeUrgency(assignment.dueDate)
      };

      const totalUrgencyScore = 
        (urgencyFactors.sentiment * 0.3) + 
        (urgencyFactors.keyPhrases * 0.4) + 
        (urgencyFactors.timeRemaining * 0.3);

      return {
        urgencyScore: totalUrgencyScore,
        insult: this.selectAppropriateInsult(totalUrgencyScore),
        analyzedFactors: urgencyFactors,
        sentimentSummary: sentimentResult.Sentiment,
        summarizedDescription,
        keyPhrases: keyPhrasesResult.KeyPhrases.map(phrase => phrase.Text)
      };
    } catch (error) {
      console.error('Unexpected error in analyzeAssignmentUrgency:', error.message);
      return null;
    }
  }

  summarizeDescription(keyPhrases, originalDescription) {
    if (keyPhrases.length === 0) {
      return originalDescription.length > 100
        ? originalDescription.substring(0, 100) + '...'
        : originalDescription;
    }

    const importantPhrases = keyPhrases
      .map((phrase) => phrase.Text)
      .slice(0, 5) // Limit to top 5 key phrases
      .join(', ');

    return importantPhrases.length > 100
      ? importantPhrases.substring(0, 100) + '...'
      : importantPhrases;
  }

  getSentimentUrgencyMultiplier(sentiment) {
    const sentimentMap = {
      'POSITIVE': 0.2,
      'NEGATIVE': 0.7,
      'NEUTRAL': 0.5,
      'MIXED': 0.6
    };
    return sentimentMap[sentiment] || 0.5;
  }

  calculateKeyPhraseUrgency(keyPhrases) {
    const urgentKeywords = [
      'important', 'critical', 'deadline', 'urgent', 
      'required', 'mandatory', 'crucial'
    ];

    const urgentPhraseCount = keyPhrases.filter(phrase => 
      urgentKeywords.some(keyword => 
        phrase.Text.toLowerCase().includes(keyword)
      )
    ).length;

    return Math.min(urgentPhraseCount * 0.3, 1);
  }

  calculateTimeUrgency(dueDate) {
    const now = new Date();
    const deadline = new Date(dueDate);
    const daysRemaining = (deadline - now) / (1000 * 60 * 60 * 24);

    return daysRemaining <= 5 ? 1 : Math.max(0, 1 - (daysRemaining / 7));
  }

  selectAppropriateInsult(urgencyScore) {
    if (urgencyScore > 0.8) {
      return DEADLINE_INSULTS[0];
    } else if (urgencyScore > 0.6) {
      return DEADLINE_INSULTS[Math.floor(Math.random() * 5)];
    } else {
      return DEADLINE_INSULTS[Math.floor(Math.random() * DEADLINE_INSULTS.length)];
    }
  }

  async checkAssignments(assignments) {
    const urgentAssignments = [];

    for (const assignment of assignments) {
      const analysis = await this.analyzeAssignmentUrgency(assignment);
      
      if (analysis && analysis.urgencyScore > 0.1) {
        urgentAssignments.push({
          ...assignment,
          urgencyDetails: analysis
        });
      }
    }

    return urgentAssignments;
  }

  async generateDeadlineAlerts(assignments) {
    const urgentAssignments = [];
  
    for (const assignment of assignments) {
      try {
        const analysis = await this.analyzeAssignmentUrgency(assignment);
  
        if (analysis && analysis.urgencyScore > 0.1) {
          urgentAssignments.push({
            ...assignment,
            urgencyDetails: analysis,
          });
  
          // Create the notification
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon192.png"),
            title: `🚨 Urgent: ${assignment.title}`,
            message: `
              ${analysis.insult}
  
              Course: ${assignment.course}
  
              Description: ${analysis.summarizedDescription}
  
              Due: ${new Date(assignment.dueDate).toLocaleString()}
            `,
            priority: 2,
          });
        }
      } catch (error) {
        console.error(`Error processing assignment '${assignment.title}':`, error.message);
      }
    }
  
    return urgentAssignments;
  }  
}

// Main Initialization Function
async function initializeAssignmentAnalyzer(assignments = []) {
    try {
    
        if (!Array.isArray(assignments)) {
            console.error("Assignments is not an array:", assignments);
            return;
        }

      const comprehendClient = await CredentialsManager.initializeAwsConfig();
      const analyzer = new AssignmentUrgencyAnalyzer(comprehendClient);
      
      // Fetch actual assignment data from Canvas or your chosen source
  
      // Process and analyze assignments
      const formattedAssignments = assignments.map((assignment) => ({
        title: assignment.name || 'Untitled Assignment',
        description: assignment.description || 'No description provided',
        course: assignment.course || 'Unknown Course',
        dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
      })).filter((assignment) => assignment.dueDate);
  
      if (formattedAssignments.length === 0) {
        console.log('No assignments with due dates found.');
        return;
      }
  
      // Analyze and generate alerts
      await analyzer.generateDeadlineAlerts(formattedAssignments);
    } catch (error) {
      console.error('Initialization Error:', error.message);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendAssignments" && message.assignments && message.assignments.length > 0) {
      console.log("Received assignments:", message.assignments); // Debugging
      initializeAssignmentAnalyzer(message.assignments);
      sendResponse({ success: true });
    } else {
      console.error("No assignments received or invalid data format.");
      initializeAssignmentAnalyzer([]);
    }
  });
  
  
// Run initialization when background script loads
initializeAssignmentAnalyzer();