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
    /**
     * Enhanced chat with project context and action support
     * @param {Array} messagesArray - Chat history
     * @param {string} aiModel - AI model to use
     * @param {Object} projectEnvVars - Decrypted env vars
     * @param {Object} projectContext - Optional project metadata (type, commands, logs, source)
     */
    async chat(messagesArray, aiModel = 'claude-4-6-opus-20260205', projectEnvVars = {}, projectContext = null) {
        const anthropicKey = projectEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = projectEnvVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            return 'AI 에러 대화 기능을 사용할 수 없습니다. (API 키 누락)';
        }

        let systemPrompt = `당신은 Orbitron의 AI DevOps 엔지니어입니다. 개발자가 코드와 배포 문제를 해결하도록 돕는 지능형 어시스턴트입니다.

## 핵심 능력
1. **소스코드 분석**: 프로젝트의 소스 코드를 직접 읽고 분석할 수 있습니다
2. **자동 수정**: 배포 실패 시 에러 로그를 분석하고 코드를 직접 수정합니다
3. **자동 재배포**: 수정된 코드로 자동 재빌드 & 재배포를 실행합니다
4. **GitHub PR 생성**: 수정 사항을 GitHub PR로 자동 생성합니다
5. **롤백**: 수정 실패 시 원본 코드로 자동 복구합니다

## 대화에서 사용 가능한 액션
사용자의 요청에 따라 아래 액션 태그를 응답 마지막에 포함하세요:
- \`[ACTION:FIX_AND_DEPLOY]\` — "이 에러 고쳐줘", "자동 수정해줘" 요청 시
- \`[ACTION:REDEPLOY]\` — "재배포 해줘", "다시 배포" 요청 시
- \`[ACTION:READ_SOURCE:파일경로]\` — 특정 소스 파일 내용이 필요할 때

## 응답 규칙
- 한국어로 답변하세요
- 능동적으로 답변: "수정하겠습니다", "분석 결과 ~ 입니다" 등
- 구체적 파일명과 코드를 포함하세요
- 마크다운 형식으로 깔끔하게 답변하세요
- 액션을 실행할 때는 반드시 사용자에게 무엇을 할 것인지 먼저 설명하고 ACTION 태그를 포함하세요`;

        // Inject project context if available
        if (projectContext) {
            systemPrompt += '\n\n## 현재 프로젝트 정보\n';
            if (projectContext.name) systemPrompt += `- **프로젝트명**: ${projectContext.name}\n`;
            if (projectContext.type) systemPrompt += `- **타입**: ${projectContext.type}\n`;
            if (projectContext.status) systemPrompt += `- **상태**: ${projectContext.status}\n`;
            if (projectContext.runtime) systemPrompt += `- **런타임**: ${projectContext.runtime}\n`;
            if (projectContext.build_command) systemPrompt += `- **빌드 명령어**: ${projectContext.build_command}\n`;
            if (projectContext.start_command) systemPrompt += `- **시작 명령어**: ${projectContext.start_command}\n`;
            if (projectContext.github_url) systemPrompt += `- **GitHub**: ${projectContext.github_url}\n`;
            if (projectContext.url) systemPrompt += `- **URL**: ${projectContext.url}\n`;

            if (projectContext.recentLogs) {
                systemPrompt += `\n### 최근 배포 로그 (마지막 100줄)\n\`\`\`\n${projectContext.recentLogs}\n\`\`\`\n`;
            }

            if (projectContext.sourceContext) {
                systemPrompt += `\n### 프로젝트 소스코드\n${projectContext.sourceContext}\n`;
            }
        }

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
