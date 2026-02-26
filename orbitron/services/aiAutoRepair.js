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
    async analyzeAndGeneratePatch(logs, projectDir, aiModel = 'claude-4-6-opus-20260205', envVars = {}) {
        const anthropicKey = envVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const geminiKey = envVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!anthropicKey && !geminiKey) {
            console.log('[AI AutoRepair] Skipping: No AI API key available.');
            return null;
        }

        // Collect relevant source files (max 10 files, max 500 lines each)
        const sourceContext = this._collectSourceFiles(projectDir);
        if (!sourceContext) return null;

        const recentLogs = logs.split('\n').slice(-150).join('\n');

        const prompt = `You are an expert DevOps engineer. A deployment has FAILED with the error logs below.
Your job is to generate EXACT code patches to fix the issue.

RULES:
1. Only fix deployment/build/configuration errors (missing imports, wrong paths, port issues, dependency errors, environment config)
2. Do NOT modify business logic
3. Return ONLY valid JSON — no markdown, no code fences, no explanation outside JSON
4. Each patch must specify the exact file path (relative to project root), the exact original text to replace, and the exact replacement text
5. Keep patches minimal — change only what's necessary

ERROR LOGS:
${recentLogs}

PROJECT SOURCE FILES:
${sourceContext}

Respond with this exact JSON structure:
{
  "canFix": true,
  "summary": "Brief description of what was wrong and what the fix does",
  "patches": [
    {
      "file": "relative/path/to/file.js",
      "original": "exact original text to find and replace",
      "modified": "exact replacement text",
      "explanation": "why this change fixes the error"
    }
  ]
}

If you CANNOT fix this error (e.g., it requires business logic changes or external service fixes), respond:
{"canFix": false, "summary": "reason why auto-fix is not possible"}`;

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
     * Returns formatted string of file contents
     */
    _collectSourceFiles(projectDir) {
        const EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.yaml', '.yml', '.toml', '.cfg', '.env'];
        const SKIP_DIRS = ['node_modules', '.git', '__pycache__', 'dist', 'build', '.next', 'venv', '.venv'];
        const MAX_FILES = 15;
        const MAX_LINES_PER_FILE = 200;

        const files = [];

        const walk = (dir, depth = 0) => {
            if (depth > 3 || files.length >= MAX_FILES) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (files.length >= MAX_FILES) break;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (!SKIP_DIRS.includes(entry.name)) {
                            walk(fullPath, depth + 1);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (EXTENSIONS.includes(ext)) {
                            try {
                                const content = fs.readFileSync(fullPath, 'utf-8');
                                const lines = content.split('\n');
                                const trimmed = lines.slice(0, MAX_LINES_PER_FILE).join('\n');
                                const relPath = path.relative(projectDir, fullPath);
                                files.push(`--- ${relPath} ---\n${trimmed}`);
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
