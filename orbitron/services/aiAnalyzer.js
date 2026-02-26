const { GoogleGenAI } = require('@google/genai');
const Anthropic = require('@anthropic-ai/sdk');

class AIAnalyzer {
    // The constructor is no longer strictly necessary to cache globals because we generate per-request clients now based on DB env vars
    constructor() {
        this.globalGemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
        this.globalAnthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    }

    async analyzeError(logs, aiModel = 'claude-4-6-opus-20260205', projectEnvVars = {}) {
        // Retrieve keys from project env vars, falling back to server-side globals
        const anthropicKey = projectEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = projectEnvVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            console.log('Skipping AI analysis: Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY are set.');
            return null;
        }

        try {
            // Trim logs to the last 200 lines to fit inside reasonable token limits
            const logLines = logs.split('\\n');
            const recentLogs = logLines.slice(-200).join('\\n');

            const prompt = `
You are an expert DevOps engineer and backend developer. A deployment has failed. 
Below are the last 200 lines of the deployment/build logs.
Your task is to:
1. Identify the root cause of the error.
2. Provide a clear, actionable, and formatted solution (markdown). 
Do NOT wrap everything in a single giant code block. Use standard markdown headers, bullet points, and small code blocks for commands. Keep it concise but helpful.

[DEPLOYMENT LOGS BEGIN]
${recentLogs}
[DEPLOYMENT LOGS END]`;

            console.log(`Requesting AI Error Analysis using model: ${aiModel}`);

            // Route to Anthropic models if requested and key is present
            if (aiModel.startsWith('claude-') && anthropicKey) {
                const anthropicClient = new Anthropic({ apiKey: anthropicKey });
                const response = await anthropicClient.messages.create({
                    model: aiModel, // e.g., 'claude-4-6-opus-20260205'
                    max_tokens: 1500,
                    messages: [{ role: 'user', content: prompt }]
                });
                return response.content[0].text;
            }

            // Route to Google models if requested (or as a fallback if Claude was requested but Anthropic key is missing)
            if (geminiKey) {
                const geminiClient = new GoogleGenAI({ apiKey: geminiKey });
                const fallbackModel = aiModel.startsWith('gemini-') ? aiModel : 'gemini-2.5-flash';
                if (!aiModel.startsWith('gemini-')) {
                    console.log(`Falling back to ${fallbackModel} because Anthropic API key is missing.`);
                }
                const response = await geminiClient.models.generateContent({
                    model: fallbackModel,
                    contents: prompt,
                });
                return response.text;
            }

            return 'AI 에러 분석을 수행할 수 없습니다. (API 설정 누락)';
        } catch (error) {
            console.error('AI Analysis failed:', error);
            return 'AI 분석 중 오류가 발생했습니다: ' + error.message;
        }
    }
    async chat(messagesArray, aiModel = 'claude-4-6-opus-20260205', projectEnvVars = {}) {
        const anthropicKey = projectEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = projectEnvVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            return 'AI 에러 대화 기능을 사용할 수 없습니다. (API 키 누락)';
        }

        const systemPrompt = "You are Orbitron's resident DevOps and Backend Expert AI. Help the developer troubleshoot their code or deployment issues.";

        // Helper: wrap a promise with a timeout
        const withTimeout = (promise, ms) => {
            let timer;
            return Promise.race([
                promise,
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), ms); })
            ]).finally(() => clearTimeout(timer));
        };

        // Helper: call Gemini
        const callGemini = async () => {
            if (!geminiKey) return null;
            console.log('[AI Chat] Falling back to Gemini...');
            const geminiClient = new GoogleGenAI({ apiKey: geminiKey });
            const fallbackModel = 'gemini-2.5-flash';
            const formattedHistory = messagesArray.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            const lastMessage = messagesArray[messagesArray.length - 1].content;
            const chat = geminiClient.chats.create({
                model: fallbackModel,
                history: formattedHistory,
                config: { systemInstruction: systemPrompt }
            });
            const response = await chat.sendMessage({ message: lastMessage });
            return response.text;
        };

        try {
            console.log(`[AI Chat] Routing chat to model: ${aiModel}`);

            // Anthropic Claude (with 15s timeout + Gemini fallback)
            if (aiModel.startsWith('claude-') && anthropicKey) {
                try {
                    const anthropicClient = new Anthropic({ apiKey: anthropicKey });
                    const response = await withTimeout(
                        anthropicClient.messages.create({
                            model: aiModel,
                            max_tokens: 1500,
                            system: systemPrompt,
                            messages: messagesArray.map(m => ({
                                role: m.role === 'assistant' ? 'assistant' : 'user',
                                content: m.content
                            }))
                        }),
                        15000
                    );
                    return response.content[0].text;
                } catch (claudeError) {
                    console.warn(`[AI Chat] Claude failed (${claudeError.message}), trying Gemini fallback...`);
                    const geminiResult = await callGemini();
                    if (geminiResult) return `⚡ *Gemini 자동 전환 (Claude 서버 응답 없음)*\n\n${geminiResult}`;
                    return `AI 서버가 현재 과부하 상태입니다. 잠시 후 다시 시도해주세요. (${claudeError.message})`;
                }
            }

            // Google Gemini (direct call)
            if (geminiKey) {
                const geminiClient = new GoogleGenAI({ apiKey: geminiKey });
                const fallbackModel = aiModel.startsWith('gemini-') ? aiModel : 'gemini-2.5-flash';
                const formattedHistory = messagesArray.slice(0, -1).map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));
                const lastMessage = messagesArray[messagesArray.length - 1].content;
                const chat = geminiClient.chats.create({
                    model: fallbackModel,
                    history: formattedHistory,
                    config: { systemInstruction: systemPrompt }
                });
                const response = await chat.sendMessage({ message: lastMessage });
                return response.text;
            }

            return 'AI 대화를 처리할 수 없습니다.';
        } catch (error) {
            console.error('[AI Chat Error] Failed:', error);
            return 'AI 서버 응답 오류가 발생했습니다: ' + error.message;
        }
    }
}

module.exports = new AIAnalyzer();
