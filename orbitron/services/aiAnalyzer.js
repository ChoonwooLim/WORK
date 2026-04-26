// services/aiAnalyzer.js — OpenClaw 기반
const openclawClient = require('./openclawClient');

// ── 오비 시스템 프롬프트 (모든 에이전트에 공통 주입) ──
const ORBI_SYSTEM = `[시스템 지시 — 오비 (Orbi) 🛡️]
너는 "오비"다. Orbitron 배포 플랫폼의 수호자.
감독님(Steven Lim)이 운영하는 모든 배포 프로젝트의 안정성을 보장하는 것이 존재 이유다.

절대원칙:
1. 분석 없이 수정하지 않는다. 로그를 안 읽었으면 수정 자격 없다.
2. 감독님 승인 없이 프로덕션 코드를 변경하지 않는다.
3. 수정 후 반드시 검증한다 (증거 제시).
4. 범위를 넘지 않는다 (요청받은 것만).
5. 파괴적 작업 전 반드시 확인한다.
6. 보안 정보를 노출하지 않는다.

Orbitron SSH: ssh stevenlim@192.168.219.101
프로젝트 경로: /home/stevenlim/WORK/orbitron/

자주 발생하는 문제:
- _orbitron_spa.py 주입 → build.dockerfile 명시로 해결
- encryptForJsonb 미사용 → JSONB 저장 실패
- DATABASE_URL 포트 3799(호스트) vs 5432(내부) 혼동
- Nginx proxy_pass 포트와 컨테이너 실제 포트 불일치

한국어로 소통. 감독님이라고 부른다.
보고 형식: 증상 → 원인 → 근본 원인 → 수정안 → 검증.`;

const ERROR_ANALYSIS_PROMPT = `배포 로그를 분석하세요:
1. **에러 감지**: 로그에서 실패 원인을 정확히 찾아내기
2. **근본 원인**: 왜 이 에러가 발생했는지 설명
3. **해결 방법**: 구체적인 수정 단계 제시
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
        const message = `${ORBI_SYSTEM}\n\n${ERROR_ANALYSIS_PROMPT}\n\n--- 배포 로그 ---\n${logs.slice(-8000)}`;
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

        // 오비 시스템 프롬프트 + 프로젝트 컨텍스트
        let prefix = ORBI_SYSTEM + '\n\n';
        if (projectContext) {
            prefix += `[프로젝트 컨텍스트]\n이름: ${projectContext.name || 'N/A'}\n타입: ${projectContext.type || 'N/A'}\n상태: ${projectContext.status || 'N/A'}\n`;
            if (projectContext.logs) prefix += `\n최근 로그:\n${projectContext.logs.slice(-3000)}\n`;
            if (projectContext.sourceFiles) prefix += `\n소스 파일:\n${projectContext.sourceFiles.slice(-3000)}\n`;
            prefix += '\n---\n\n';
        }
        const lastUserMsg = [...messagesArray].reverse().find(m => m.role === 'user');
        const message = prefix + (lastUserMsg?.content || '');
        try {
            return await openclawClient.chat(agentId, sessionKey, message);
        } catch (e) {
            console.error('[AiAnalyzer] OpenClaw chat 실패:', e.message);
            return `⚠️ AI 응답 실패: ${e.message}`;
        }
    }
}

module.exports = new AiAnalyzer();
