require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { BASE_PROMPT, getSystemPrompt } = require("./prompts");
const { basePrompt: nodeBasePrompt } = require("./defaults/node");
const { basePrompt: reactBasePrompt } = require("./defaults/react");

// Mistral AI API URL and key
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_API_KEY = "Dqa6NVB3wtarl5hNrI9tsbSt97GW0BGe"

// Define Mistral system prompt
const BOLT_AI_SYSTEM_PROMPT = `You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, and best practices.`;

const app = express();
app.use(cors({
    origin: "https://bolt-harkirat.vercel.app"
}));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});


// Helper function to generate response using Mistral AI
const generateMistralResponse = async(messages, maxTokens = 12000, systemPrompt = BOLT_AI_SYSTEM_PROMPT) => {
    try {
        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(msg => ({ role: msg.role, content: msg.content }))
        ];

        const response = await axios.post(
            MISTRAL_API_URL, {
                model: 'mistral-large-latest', // You can change to 'mistral-small', 'mistral-medium', etc.
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: maxTokens,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                },
                timeout: 100000, // 60 second timeout
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error generating response from Mistral AI:', error.response.data || error.message);
        throw new Error('Failed to generate response from Mistral AI');
    }
};

// Template endpoint
app.post("/template", async(req, res) => {
    try {
        const prompt = req.body.prompt;

        // Simple system prompt to classify as node or react
        const templateSystemPrompt = "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra";

        const answer = await generateMistralResponse(
            [{ role: 'user', content: prompt }],
            200,
            templateSystemPrompt
        );

        const cleanAnswer = answer.trim().toLowerCase();

        if (cleanAnswer.includes("react")) {
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
            return;
        }

        if (cleanAnswer.includes("node")) {
            res.json({
                prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt]
            });
            return;
        }

        res.status(403).json({ message: "You cant access this" });
    } catch (error) {
        console.error("Template endpoint error:", error);
        res.status(500).json({ error: "Failed to process template request" });
    }
});

// Chat endpoint
app.post("/chat", async(req, res) => {
    try {
        const messages = req.body.messages;
        const response = await generateMistralResponse(messages, 8000, getSystemPrompt());

        res.json({
            response: response
        });
    } catch (error) {
        console.error("Chat endpoint error:", error);
        res.status(500).json({ error: "Failed to process chat request" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bolt backend running on port ${PORT}`);
});