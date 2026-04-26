// services/aiAnalyzer.js — OpenClaw 기반
const openclawClient = require('./openclawClient');

const ERROR_ANALYSIS_PROMPT = `당신은 Orbitron 배포 플랫폼의 기술 분석 AI입니다.
사용자가 배포 로그를 보내면 다음 구조로 분석하세요:
1. **에러 감지**: 로그에서 실패 원인을 정확히 찾아내기
2. **근본 원인**: 왜 이 에러가 발생했는지 설명
3. **해결 방법**: 구체적인 수정 단계 제시
한국어로 답변하세요. 코드 블록이 필요하면 \`\`\`로 감싸세요.
자동 수리가 가능하면 답변 마지막에 [ACTION:FIX_AND_DEPLOY] 태그를 붙이세요.
재배포만 하면 되면 [ACTION:REDEPLOY] 태그를 붙이세요.`;

class AiAnalyzer {
    async analyzeError(logs, _aiModel = '', _projectEnvVars = {}, project = null) {
        if (!openclawClient.isConfigured()) {
            return '⚠️ OpenClaw 게이트웨이가 설정되지 않았습니다. 서버 설정에서 URL과 토큰을 입력하세요.';
        }
        const agentId = openclawClient.resolveAgent(project);
        if (!agentId) {
            return '⚠️ OpenClaw 에이전트가 설정되지 않았습니다. 서버 설정에서 기본 에이전트를 선택하세요.';
        }
        const sessionKey = openclawClient.sessionKey(agentId, project?.id || 'global', 'error-analysis');
        const message = `${ERROR_ANALYSIS_PROMPT}\n\n--- 배포 로그 ---\n${logs.slice(-8000)}`;
        try {
            return await openclawClient.chat(agentId, sessionKey, message);
        } catch (e) {
            console.error('[AiAnalyzer] OpenClaw analyzeError 실패:', e.message);
            return `⚠️ AI 분석 실패: ${e.message}`;
        }
    }

    async chat(messagesArray, _aiModel = '', _projectEnvVars = {}, projectContext = null, project = null) {
        if (!openclawClient.isConfigured()) {
            return '⚠️ OpenClaw 게이트웨이가 설정되지 않았습니다.';
        }
        const agentId = openclawClient.resolveAgent(project);
        if (!agentId) {
            return '⚠️ OpenClaw 에이전트가 설정되지 않았습니다.';
        }
        const sessionKey = openclawClient.sessionKey(agentId, project?.id || 'global', 'chat');
        let contextPrefix = '';
        if (projectContext) {
            contextPrefix = `[프로젝트 컨텍스트]\n이름: ${projectContext.name || 'N/A'}\n타입: ${projectContext.type || 'N/A'}\n상태: ${projectContext.status || 'N/A'}\n`;
            if (projectContext.logs) contextPrefix += `\n최근 로그:\n${projectContext.logs.slice(-3000)}\n`;
            if (projectContext.sourceFiles) contextPrefix += `\n소스 파일:\n${projectContext.sourceFiles.slice(-3000)}\n`;
            contextPrefix += '\n---\n\n';
        }
        const lastUserMsg = [...messagesArray].reverse().find(m => m.role === 'user');
        const message = contextPrefix + (lastUserMsg?.content || '');
        try {
            return await openclawClient.chat(agentId, sessionKey, message);
        } catch (e) {
            console.error('[AiAnalyzer] OpenClaw chat 실패:', e.message);
            return `⚠️ AI 응답 실패: ${e.message}`;
        }
    }
}

module.exports = new AiAnalyzer();
