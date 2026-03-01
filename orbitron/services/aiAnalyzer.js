const { GoogleGenAI } = require('@google/genai');
const Anthropic = require('@anthropic-ai/sdk');

class AIAnalyzer {
    // The constructor is no longer strictly necessary to cache globals because we generate per-request clients now based on DB env vars
    constructor() {
        this.globalGemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
        this.globalAnthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    }

    async analyzeError(logs, aiModel = 'claude-4-6-sonnet-20260217', projectEnvVars = {}) {
        // Retrieve keys from project env vars, falling back to server-side globals
        const anthropicKey = projectEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = projectEnvVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            console.log('Skipping AI analysis: Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY are set.');
            return null;
        }

        try {
            // Trim logs — smart extraction: find error lines and include surrounding context
            const logLines = logs.split('\n');
            const errorPatterns = /error|ERR!|failed|FATAL|exception|Cannot find|Module not found|ENOENT|EACCES|ECONNREFUSED|exit code|SyntaxError|TypeError|ReferenceError/i;
            let errorIdx = -1;
            for (let i = logLines.length - 1; i >= 0; i--) {
                if (errorPatterns.test(logLines[i])) { errorIdx = i; break; }
            }
            // Include 50 lines before the error and everything after, capped at 300 lines total
            const startIdx = errorIdx > 0 ? Math.max(0, errorIdx - 50) : Math.max(0, logLines.length - 300);
            const recentLogs = logLines.slice(startIdx, startIdx + 300).join('\n');

            const prompt = `당신은 10년 경력의 시니어 DevOps 엔지니어입니다. 배포가 실패했습니다.
아래 배포/빌드 로그를 분석하세요.

## 분석 절차 (반드시 순서대로)
1. **에러 라인 찾기**: 로그에서 ERROR, FATAL, failed, exit code 등 핵심 에러 메시지를 정확히 인용하세요
2. **근본 원인 진단**: 단순 증상이 아닌 왜 이 에러가 발생했는지 원인을 밝히세요
3. **구체적 해결책 제시**: 정확한 파일명, 수정 코드, 실행할 명령어를 포함하세요

## 응답 형식
- 마크다운 사용, 한국어로 답변
- 수정이 필요한 코드는 \`before → after\` 형태로 명확히 보여주세요
- "~할 수 있습니다", "~해보세요" 같은 모호한 표현 금지. 정확한 지시를 하세요

[배포 로그]
${recentLogs}
[로그 끝]`;

            // RAG: Search knowledge DB for similar past errors
            let knowledgeContext = '';
            try {
                const errorKnowledge = require('./errorKnowledge');
                const similar = await errorKnowledge.findSimilar(recentLogs);
                knowledgeContext = errorKnowledge.formatForPrompt(similar);
            } catch (e) { /* knowledge DB not yet available */ }

            const fullPrompt = knowledgeContext ? prompt + '\n' + knowledgeContext : prompt;

            console.log(`Requesting AI Error Analysis using model: ${aiModel}`);

            // Route to Anthropic models if requested and key is present
            if (aiModel.startsWith('claude-') && anthropicKey) {
                const anthropicClient = new Anthropic({ apiKey: anthropicKey });
                const response = await anthropicClient.messages.create({
                    model: aiModel,
                    max_tokens: 4096,
                    messages: [{ role: 'user', content: fullPrompt }]
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
                const result = await geminiClient.models.generateContent({
                    model: aiModel,
                    contents: fullPrompt
                });
                return result.text;
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
    async chat(messagesArray, aiModel = 'claude-4-6-sonnet-20260217', projectEnvVars = {}, projectContext = null) {
        const anthropicKey = projectEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = projectEnvVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            return 'AI 에러 대화 기능을 사용할 수 없습니다. (API 키 누락)';
        }

        let systemPrompt = `당신은 Orbitron 배포 플랫폼의 시니어 DevOps 엔지니어 AI입니다. 배포 오류를 정확하게 진단하고 직접 코드를 수정하여 문제를 해결합니다.

## 절대 규칙
- **"수정하겠습니다", "확인해보겠습니다" 같은 미래형 표현을 쓰지 마세요.** 분석 결과와 수정 방법을 즉시 제시하세요.
- **모호한 답변 금지**: "~일 수 있습니다", "~해보세요" 대신 "~입니다", "~하세요"로 단정적으로 답하세요.
- 항상 **정확한 파일명, 줄번호(가능한 경우), 수정 전/후 코드**를 포함하세요.
- 한국어로 답변하세요.

## 배포 오류 진단 절차 (반드시 이 순서를 따르세요)
1. **에러 메시지 정확히 인용**: 로그에서 ERROR, FATAL, failed, exit code 등 핵심 에러를 찾아 그대로 인용
2. **근본 원인 1가지로 특정**: 여러 가능성 나열 금지. 가장 가능성 높은 원인 1가지를 단정
3. **수정 코드 제시**: before/after 형태로 정확한 코드 변경사항 제시
4. **ACTION 태그 포함**: 수정/재배포가 필요하면 반드시 태그 포함

## 흔한 배포 오류 패턴 (이 패턴에 맞으면 즉시 진단)
- \`Module not found\` / \`Cannot find module\` → package.json 의존성 누락 또는 import 경로 오류
- \`ENOENT\` → 파일/디렉토리 경로 오류
- \`EADDRINUSE\` → 포트 충돌 (project.port 확인)
- \`exit code 1\` + npm → 빌드 스크립트 오류, package.json scripts 확인
- \`Dockerfile\` 에러 → Dockerfile 문법, base 이미지, COPY 경로 확인
- \`ECONNREFUSED\` → DB 연결 실패, DATABASE_URL 환경변수 확인
- \`SyntaxError\` → 코드 문법 오류, 해당 파일의 정확한 위치 지정
- \`Permission denied\` → 파일 권한 또는 Docker 권한 문제
- \`OOM\` / \`Killed\` → 메모리 부족, Docker 리소스 제한 확인

## 사용 가능한 액션 (응답 마지막에 태그 포함)
- \`[ACTION:FIX_AND_DEPLOY]\` — 에러를 자동 수정하고 재배포 (사용자가 수정/고쳐달라고 요청할 때)
- \`[ACTION:REDEPLOY]\` — 현재 코드 그대로 재배포 (설정만 변경했을 때)
- \`[ACTION:READ_SOURCE:파일경로]\` — 추가 소스 파일이 필요할 때

### ACTION 태그 사용 기준
- 사용자가 "고쳐줘", "수정해줘", "에러 해결" 등을 말하면 → 반드시 \`[ACTION:FIX_AND_DEPLOY]\` 포함
- 사용자가 "재배포", "다시 배포" 등을 말하면 → 반드시 \`[ACTION:REDEPLOY]\` 포함
- 단순 질문이면 → ACTION 태그 없이 분석 결과만 답변`;

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

            if (projectContext.buildConfig) {
                systemPrompt += `\n### 빌드 설정 파일 (Dockerfile/docker-compose.yml)\n${projectContext.buildConfig}\n`;
            }
        }

        // RAG: Search knowledge DB for similar past errors
        if (projectContext && projectContext.recentLogs) {
            try {
                const errorKnowledge = require('./errorKnowledge');
                const similar = await errorKnowledge.findSimilar(projectContext.recentLogs, projectContext.type);
                const knowledgeContext = errorKnowledge.formatForPrompt(similar);
                if (knowledgeContext) {
                    systemPrompt += knowledgeContext;
                }
            } catch (e) { /* knowledge DB not yet available */ }
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
                            max_tokens: 4096,
                            system: systemPrompt,
                            messages: messagesArray.map(m => ({
                                role: m.role === 'assistant' ? 'assistant' : 'user',
                                content: m.content
                            }))
                        }),
                        30000
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
