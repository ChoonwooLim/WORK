const { GoogleGenAI } = require('@google/genai');
const Anthropic = require('@anthropic-ai/sdk');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const path = require('path');

class AIAutoRepair {

    /**
     * Analyze build/deploy error and generate code patches
     * Returns: { patches: [{ file, original, modified, explanation }], summary } | null
     */
    async analyzeAndGeneratePatch(logs, projectDir, aiModel = 'claude-4-6-sonnet-20260217', envVars = {}) {
        const anthropicKey = envVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = envVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            console.log('[AI AutoRepair] Skipping: No AI API key available.');
            return null;
        }

        // Collect relevant source files with priority ordering
        const sourceContext = this._collectSourceFiles(projectDir);
        if (!sourceContext) return null;

        // Smart log extraction: find error lines and include context around them
        const logLines = logs.split('\n');
        const errorPatterns = /error|ERR!|failed|FATAL|exception|Cannot find|Module not found|ENOENT|EACCES|ECONNREFUSED|exit code|SyntaxError|TypeError|ReferenceError/i;
        let errorIdx = -1;
        for (let i = logLines.length - 1; i >= 0; i--) {
            if (errorPatterns.test(logLines[i])) { errorIdx = i; break; }
        }
        const startIdx = errorIdx > 0 ? Math.max(0, errorIdx - 80) : Math.max(0, logLines.length - 300);
        const recentLogs = logLines.slice(startIdx, startIdx + 300).join('\n');

        const prompt = `당신은 시니어 DevOps 엔지니어입니다. 배포가 실패했습니다.
에러 로그를 분석하고 정확한 코드 패치를 생성하세요.

## 규칙
1. 배포/빌드/설정 오류만 수정하세요 (누락된 import, 잘못된 경로, 포트 문제, 의존성 오류, 환경 설정)
2. 비즈니스 로직은 수정하지 마세요
3. 반드시 유효한 JSON만 반환하세요 — 마크다운, 코드 펜스, JSON 외 설명 없이
4. 각 패치는 프로젝트 루트 기준 정확한 파일 경로, 교체할 원본 텍스트, 교체 텍스트를 포함
5. 최소한의 변경만 하세요

## 흔한 배포 오류 패턴 (이 패턴을 우선 확인)
- Dockerfile 오류: COPY 경로, base 이미지, RUN 명령어 문법
- package.json: 누락된 의존성, 잘못된 scripts
- 포트 불일치: Dockerfile EXPOSE와 실제 앱 포트가 달라서 연결 실패
- 환경변수 누락: DATABASE_URL, API 키 등이 코드에서 참조되지만 설정되지 않음
- 파일 경로 오류: import/require 경로가 실제 파일 위치와 불일치
- Python: requirements.txt 누락, 잘못된 모듈명

## 에러 로그
${recentLogs}

## 프로젝트 소스 파일
${sourceContext}

다음 JSON 구조로만 응답하세요:
{
  "canFix": true,
  "summary": "무엇이 잘못되었고 어떻게 수정하는지 한국어로 간략 설명",
  "patches": [
    {
      "file": "relative/path/to/file.js",
      "original": "교체할 정확한 원본 텍스트",
      "modified": "교체 텍스트",
      "explanation": "이 변경이 에러를 수정하는 이유"
    }
  ]
}

자동 수정이 불가능한 경우 (비즈니스 로직 변경, 외부 서비스 문제 등):
{"canFix": false, "summary": "자동 수정이 불가능한 이유"}`;

        // RAG: Search knowledge DB for similar past errors
        let knowledgeRef = '';
        try {
            const errorKnowledge = require('./errorKnowledge');
            const similar = await errorKnowledge.findSimilar(recentLogs, null);
            if (similar.length > 0) {
                knowledgeRef = '\n\n## 참고: 과거 유사 에러 해결 사례\n';
                for (const k of similar) {
                    knowledgeRef += `- 패턴: ${k.error_pattern}\n  원인: ${k.root_cause}\n  해결: ${k.solution}\n`;
                }
                prompt += knowledgeRef;
            }
        } catch (e) { /* knowledge DB not available yet */ }

        try {
            console.log(`[AI AutoRepair] Requesting patch generation via ${aiModel}...`);
            let responseText;

            if (aiModel.startsWith('claude-') && anthropicKey) {
                const client = new Anthropic({ apiKey: anthropicKey });
                const response = await client.messages.create({
                    model: aiModel,
                    max_tokens: 4000,
                    messages: [{ role: 'user', content: prompt }]
                });
                responseText = response.content[0].text;
            } else if (geminiKey) {
                const client = new GoogleGenAI({ apiKey: geminiKey });
                const model = aiModel.startsWith('gemini-') ? aiModel : 'gemini-2.5-flash';
                const response = await client.models.generateContent({
                    model,
                    contents: prompt,
                });
                responseText = response.text;
            } else {
                return null;
            }

            // Parse JSON from response (strip markdown fences if any)
            const jsonStr = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const result = JSON.parse(jsonStr);

            if (!result.canFix) {
                console.log(`[AI AutoRepair] AI says cannot fix: ${result.summary}`);
                return { canFix: false, summary: result.summary, patches: [] };
            }

            console.log(`[AI AutoRepair] Generated ${result.patches.length} patches`);
            return result;

        } catch (error) {
            console.error('[AI AutoRepair] Patch generation failed:', error.message);
            return null;
        }
    }

    /**
     * Apply patches to project source code
     * Returns: { applied: number, failed: number, details: string }
     */
    applyPatches(projectDir, patches) {
        let applied = 0;
        let failed = 0;
        let details = '';

        for (const patch of patches) {
            const filePath = path.join(projectDir, patch.file);
            try {
                if (!fs.existsSync(filePath)) {
                    details += `  ⚠️ ${patch.file}: 파일 없음 (건너뜀)\n`;
                    failed++;
                    continue;
                }

                let content = fs.readFileSync(filePath, 'utf-8');
                if (!content.includes(patch.original)) {
                    details += `  ⚠️ ${patch.file}: 원본 텍스트 불일치 (건너뜀)\n`;
                    failed++;
                    continue;
                }

                content = content.replace(patch.original, patch.modified);
                fs.writeFileSync(filePath, content, 'utf-8');
                details += `  ✅ ${patch.file}: ${patch.explanation}\n`;
                applied++;

            } catch (e) {
                details += `  ❌ ${patch.file}: ${e.message}\n`;
                failed++;
            }
        }

        return { applied, failed, details };
    }

    /**
     * Create a GitHub PR with the AI-generated fixes
     * Uses the GitHub REST API via curl
     */
    async createGitHubPR(project, projectDir, patches, summary) {
        try {
            const githubUrl = project.github_url || '';
            // Extract owner/repo from https://github.com/owner/repo.git
            const match = githubUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
            if (!match) {
                return { success: false, message: 'GitHub URL 파싱 불가' };
            }
            const ownerRepo = match[1];
            const baseBranch = project.branch || 'main';
            const fixBranch = `fix/ai-auto-repair-${Date.now()}`;

            // Create branch, commit patches, and push
            const gitOps = [
                `cd ${projectDir}`,
                `git checkout -b ${fixBranch}`,
                `git add -A`,
                `git commit -m "🤖 AI Auto-Repair: ${summary.substring(0, 72)}"`,
                `git push origin ${fixBranch}`
            ].join(' && ');

            await execAsync(gitOps, { maxBuffer: 1024 * 1024 * 10 });

            // Create PR via GitHub API
            const githubToken = process.env.GITHUB_TOKEN || project.env_vars?.GITHUB_TOKEN;
            if (!githubToken) {
                // No token = can't create PR, but branch was pushed
                return {
                    success: true,
                    message: `브랜치 ${fixBranch} 생성 완료 (GITHUB_TOKEN 없어서 PR 수동 생성 필요)`,
                    branch: fixBranch
                };
            }

            // Build PR body with diff summary
            const prBody = [
                '## 🤖 AI 자동 복구',
                '',
                `**요약:** ${summary}`,
                '',
                '### 수정된 파일',
                ...patches.map(p => `- \`${p.file}\`: ${p.explanation}`),
                '',
                '> 이 PR은 Orbitron AI Auto-Repair에 의해 자동 생성되었습니다.',
                '> 반드시 코드를 검토한 후 병합해주세요.'
            ].join('\n');

            const prData = JSON.stringify({
                title: `🤖 AI Auto-Repair: ${summary.substring(0, 72)}`,
                body: prBody,
                head: fixBranch,
                base: baseBranch
            });

            const curlCmd = `curl -s -X POST "https://api.github.com/repos/${ownerRepo}/pulls" \
                -H "Authorization: token ${githubToken}" \
                -H "Accept: application/vnd.github.v3+json" \
                -d '${prData.replace(/'/g, "'\\''")}'`;

            const { stdout } = await execAsync(curlCmd, { maxBuffer: 1024 * 1024 });
            const prResponse = JSON.parse(stdout);

            if (prResponse.html_url) {
                return {
                    success: true,
                    message: 'GitHub PR 생성 완료',
                    prUrl: prResponse.html_url,
                    branch: fixBranch
                };
            } else {
                return {
                    success: true,
                    message: `브랜치 ${fixBranch} push 완료 (PR 생성은 수동 필요)`,
                    branch: fixBranch,
                    error: prResponse.message
                };
            }

        } catch (error) {
            console.error('[AI AutoRepair] GitHub PR creation failed:', error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * Revert patches by restoring from git
     */
    async revertPatches(projectDir, branch = 'main') {
        try {
            await execAsync(`cd ${projectDir} && git checkout ${branch} && git reset --hard origin/${branch}`);
            return true;
        } catch (e) {
            console.error('[AI AutoRepair] Revert failed:', e.message);
            return false;
        }
    }

    /**
     * Collect relevant source files for AI context
     * Priority-ordered: critical config files first, then source code
     */
    _collectSourceFiles(projectDir) {
        const EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.yaml', '.yml', '.toml', '.cfg', '.env', '.html', '.css'];
        const SKIP_DIRS = ['node_modules', '.git', '__pycache__', 'dist', 'build', '.next', 'venv', '.venv', '.cache', 'coverage'];
        const MAX_FILES = 25;
        const MAX_LINES_PER_FILE = 300;

        const files = [];

        // Phase 1: Priority files — always collect these first
        const priorityFiles = [
            'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
            'package.json', 'requirements.txt', 'pyproject.toml',
            '.env', '.env.example', '.env.production',
            'orbitron.yaml', 'next.config.js', 'next.config.mjs', 'next.config.ts',
            'vite.config.js', 'vite.config.ts', 'tsconfig.json',
            'nginx.conf', 'Procfile'
        ];

        for (const pf of priorityFiles) {
            if (files.length >= MAX_FILES) break;
            const fullPath = path.join(projectDir, pf);
            try {
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const lines = content.split('\n');
                    const trimmed = lines.slice(0, MAX_LINES_PER_FILE).join('\n');
                    files.push(`--- ${pf} (${lines.length} lines, PRIORITY) ---\n${trimmed}`);
                }
            } catch { }
        }

        // Phase 2: Walk remaining source files
        const walk = (dir, depth = 0) => {
            if (depth > 4 || files.length >= MAX_FILES) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                // Sort: files first (higher chance of being relevant), then dirs
                const sorted = entries.sort((a, b) => {
                    if (a.isFile() && b.isDirectory()) return -1;
                    if (a.isDirectory() && b.isFile()) return 1;
                    return a.name.localeCompare(b.name);
                });
                for (const entry of sorted) {
                    if (files.length >= MAX_FILES) break;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (!SKIP_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
                            walk(fullPath, depth + 1);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (EXTENSIONS.includes(ext)) {
                            // Skip if already collected as priority file
                            const relPath = path.relative(projectDir, fullPath);
                            if (files.some(f => f.includes(`--- ${relPath} `))) continue;
                            try {
                                const content = fs.readFileSync(fullPath, 'utf-8');
                                const lines = content.split('\n');
                                const trimmed = lines.slice(0, MAX_LINES_PER_FILE).join('\n');
                                files.push(`--- ${relPath} (${lines.length} lines) ---\n${trimmed}`);
                            } catch { }
                        }
                    }
                }
            } catch { }
        };

        walk(projectDir);

        if (files.length === 0) return null;
        return files.join('\n\n');
    }
}

module.exports = new AIAutoRepair();
