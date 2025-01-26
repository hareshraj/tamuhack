import { ComprehendClient, DetectSentimentCommand, DetectKeyPhrasesCommand } from "@aws-sdk/client-comprehend";

class CredentialsManager {
    static async getCredentials() {
        // Use AWS credential providers or your preferred method
        return {
            accessKeyId: 'AKIAV5AJXWXYLD5DSGIR',
            secretAccessKey: 'Xje/0YXbhtFfYoMPH+QRW7vi8bdO0tyOfATylqzL',
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
    "Congratulations! You've reached Olympic-level deadline dodging.",
    "Procrastination is your superpower, and not in a good way!",
    "Looks like you're playing chicken with academic disaster again.",
    "Your assignment is throwing more shade than a tropical rainforest.",
    "Your future self is about to write a strongly worded letter to present you.",
    "Aw man not again",
    "You got this I believe in you!"
];

class AssignmentUrgencyAnalyzer {
    constructor(comprehendClient) {
        this.comprehendClient = comprehendClient;
    }

    async analyzeAssignmentUrgency(assignment) {
        try {
            const sentimentParams = {
                Text: (assignment.description || assignment.title).substring(0, 4900),
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
            return originalDescription.substring(0, 100) + '...';
        }

        const importantPhrases = keyPhrases
            .map((phrase) => phrase.Text)
            .slice(0, 3) // Reduce to top 3 phrases
            .join(', ')
            .substring(0, 100);

        return importantPhrases + '...';
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
            'required', 'mandatory', 'crucial', 'must'
        ];
    
        const importantKeywordBonus = ['important', 'mandatory'];
    
        const urgentPhraseCount = keyPhrases.filter(phrase =>
            urgentKeywords.some(keyword =>
                phrase.Text.toLowerCase().includes(keyword)
            )
        ).length;
    
        const importantPhraseCount = keyPhrases.filter(phrase =>
            importantKeywordBonus.some(keyword =>
                phrase.Text.toLowerCase().includes(keyword)
            )
        ).length;
    
        // Boost the urgency score more for important keywords
        return Math.min((urgentPhraseCount + importantPhraseCount * 2) * 0.3, 1);
    }
    
    
    calculateTimeUrgency(dueDate) {
        const now = new Date();
        const deadline = new Date(dueDate);
        const daysRemaining = (deadline - now) / (1000 * 60 * 60 * 24);
    
        return daysRemaining <= 5 ? 1 : Math.max(0, 1 - (daysRemaining / 7));
    }
    
    selectAppropriateInsult(urgencyScore) {
        if (urgencyScore >= 0.75) return DEADLINE_INSULTS[0];
        if (urgencyScore >= 0.65) return DEADLINE_INSULTS[1];
        if (urgencyScore >= 0.55) return DEADLINE_INSULTS[2];
        if (urgencyScore >= 0.45) return DEADLINE_INSULTS[3];
        if (urgencyScore >= 0.35) return DEADLINE_INSULTS[4];
        if (urgencyScore >= 0.25) return DEADLINE_INSULTS[5];
        return DEADLINE_INSULTS[6];
    }    
}

async function displayAlerts() {
    chrome.storage.local.get(["assignments"], async (data) => {
        const assignments = data.assignments || [];
        const now = new Date();

        for (const assignment of assignments) {
            const dueDate = new Date(assignment.dueDate);
            const timeUntilDeadline = dueDate - now;

            if (timeUntilDeadline <= 24 * 60 * 60 * 1000 && timeUntilDeadline > 0) {
                const comprehendClient = await CredentialsManager.initializeAwsConfig();
                const analyzer = new AssignmentUrgencyAnalyzer(comprehendClient);
                const urgencyAnalysis = await analyzer.analyzeAssignmentUrgency(assignment);

                if (urgencyAnalysis) {
                    const insult = urgencyAnalysis.insult;
                    console.log(`Assignment: ${assignment.title} - Insult: ${insult}`);
                }
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icons/icon192.png'),
                    title: `🚨 Urgent: ${assignment.title}`,
                    message: `Course: ${assignment.course} - Due in ${Math.round(timeUntilDeadline / (1000 * 60 * 60))} hours.`,
                    priority: 2
                });
            }
        }
    });
}

const assignments = [
    {
        title: "Machine Problem 2",
        course: "CSCE 410",
        description: "Finish the problem on time. This is a critical assignment.",
        dueDate: "2025-01-27T23:59:59.000Z"
    },
    {
        title: "Read Chapter 5",
        course: "CSCE 482",
        description: "Read chapter 5 of the textbook.",
        dueDate: "2025-01-28T23:59:59.000Z"
    },
    {
        title: "Homework 1",
        course: "CSCE 449",
        description: "Submit the homework by the deadline. This is mandatory and very important!",
        dueDate: "2025-01-29T23:59:59.000Z"
    }
];

async function displaySampleAlerts() {
    const now = new Date();

    for (const assignment of assignments) {
        const dueDate = new Date(assignment.dueDate);
        const timeUntilDeadline = dueDate - now;

        if (timeUntilDeadline > 0) {
            const comprehendClient = await CredentialsManager.initializeAwsConfig();
            const analyzer = new AssignmentUrgencyAnalyzer(comprehendClient);
            const urgencyAnalysis = await analyzer.analyzeAssignmentUrgency(assignment);

            if (urgencyAnalysis) {
                const insult = urgencyAnalysis.insult;
                console.log(`Assignment: ${assignment.title} - Insult: ${insult}`);
            }
            chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon192.png'),
                title: `🚨 Urgent: ${assignment.title}`,
                message: `Course: ${assignment.course} - Due in ${Math.round(timeUntilDeadline / (1000 * 60 * 60))} hours. ${urgencyAnalysis ? urgencyAnalysis.insult : ''}`,
                priority: 2
            });
        }
    }
}

// Save sample assignments to local storage and display alerts
chrome.storage.local.set({ "assignments": assignments }, () => {
    if (chrome.runtime.lastError) {
        console.error('Storage ERROR:', chrome.runtime.lastError);
    } else {
        console.log("Sample assignments saved.");
        displaySampleAlerts();
    }
});

displayAlerts();
