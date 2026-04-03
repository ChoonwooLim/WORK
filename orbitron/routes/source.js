const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const { decrypt } = require('../db/crypto');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', 'build', '.next', 'venv', '.venv', '.cache', 'coverage']);
const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.yaml', '.yml', '.toml', '.cfg', '.env', '.html', '.css', '.md', '.sh', '.sql']);
const MAX_FILE_SIZE = 100 * 1024; // 100KB per file

/**
 * GET /api/projects/:id/source/tree
 * Returns the file tree of the project
 */
router.get('/:id/source/tree', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '프로젝트 소스 디렉토리가 없습니다.' });
        }

        const tree = buildFileTree(projectDir, projectDir, 0, 4);
        res.json({ tree, projectDir: project.subdomain });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/projects/:id/source/file?path=relative/path
 * Returns the content of a specific file
 */
router.get('/:id/source/file', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        const fullPath = path.join(projectDir, filePath);

        // Security: prevent directory traversal
        if (!fullPath.startsWith(projectDir)) {
            return res.status(403).json({ error: '접근이 거부되었습니다.' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_FILE_SIZE) {
            return res.status(413).json({ error: '파일이 너무 큽니다 (최대 100KB)' });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const ext = path.extname(fullPath).toLowerCase();

        res.json({
            path: filePath,
            content,
            size: stat.size,
            extension: ext,
            lastModified: stat.mtime,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/projects/:id/source/file
 * Saves modifications to a specific file
 */
router.post('/:id/source/file', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'path 및 content 파라미터가 필요합니다.' });
        }

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        const fullPath = path.join(projectDir, filePath);

        // Security: prevent directory traversal
        if (!fullPath.startsWith(projectDir)) {
            return res.status(403).json({ error: '접근이 거부되었습니다.' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        // Write content to file
        fs.writeFileSync(fullPath, content, 'utf-8');

        res.json({ success: true, message: '파일이 성공적으로 저장되었습니다.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/projects/:id/source/context
 * Returns an AI-ready summary of project source (auto-collected)
 */
router.get('/:id/source/context', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '소스 디렉토리가 없습니다.' });
        }

        const sourceContext = collectSourceContext(projectDir);

        // Get recent deploy logs
        const lastDeployment = await db.queryOne(
            'SELECT logs, status FROM deployments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
            [project.id]
        );

        let recentLogs = null;
        if (lastDeployment && lastDeployment.logs) {
            const logLines = lastDeployment.logs.split('\n');
            recentLogs = logLines.slice(-100).join('\n');
        }

        res.json({
            name: project.name,
            type: project.type,
            status: project.status,
            build_command: project.build_command,
            start_command: project.start_command,
            github_url: project.github_url,
            sourceContext,
            recentLogs,
            lastDeployStatus: lastDeployment?.status || null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Build file tree recursively
 */
function buildFileTree(baseDir, currentDir, depth = 0, maxDepth = 4) {
    if (depth >= maxDepth) return [];
    const items = [];

    try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.relative(baseDir, fullPath);

            if (entry.isDirectory()) {
                const children = buildFileTree(baseDir, fullPath, depth + 1, maxDepth);
                items.push({ name: entry.name, path: relPath, type: 'dir', children });
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const stat = fs.statSync(fullPath);
                items.push({
                    name: entry.name,
                    path: relPath,
                    type: 'file',
                    size: stat.size,
                    extension: ext,
                });
            }
        }
    } catch { }

    // Sort: directories first, then files alphabetically
    items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return items;
}

/**
 * Collect source files for AI context
 */
function collectSourceContext(projectDir) {
    const MAX_FILES = 25;
    const MAX_LINES = 200;
    const files = [];

    // Phase 1: Priority files — always collect critical config files first
    const priorityFiles = [
        'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
        'package.json', 'requirements.txt', 'pyproject.toml',
        '.env.example', '.env.production',
        'orbitron.yaml', 'next.config.js', 'next.config.mjs',
        'vite.config.js', 'vite.config.ts', 'tsconfig.json',
        'nginx.conf', 'Procfile'
    ];

    for (const pf of priorityFiles) {
        if (files.length >= MAX_FILES) break;
        const fullPath = path.join(projectDir, pf);
        try {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const stat = fs.statSync(fullPath);
                if (stat.size > MAX_FILE_SIZE) continue;
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                const trimmed = lines.slice(0, MAX_LINES).join('\n');
                files.push(`--- ${pf} (${lines.length} lines, PRIORITY) ---\n${trimmed}${lines.length > MAX_LINES ? '\n... (truncated)' : ''}`);
            }
        } catch { }
    }

    // Phase 2: Walk remaining source files
    const walk = (dir, depth = 0) => {
        if (depth > 3 || files.length >= MAX_FILES) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (files.length >= MAX_FILES) break;
                if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (SOURCE_EXTENSIONS.has(ext)) {
                        const relPath = path.relative(projectDir, fullPath);
                        // Skip if already collected as priority file
                        if (files.some(f => f.includes(`--- ${relPath} `))) continue;
                        try {
                            const stat = fs.statSync(fullPath);
                            if (stat.size > MAX_FILE_SIZE) continue;
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            const lines = content.split('\n');
                            const trimmed = lines.slice(0, MAX_LINES).join('\n');
                            files.push(`--- ${relPath} (${lines.length} lines) ---\n${trimmed}${lines.length > MAX_LINES ? '\n... (truncated)' : ''}`);
                        } catch { }
                    }
                }
            }
        } catch { }
    };

    walk(projectDir);
    return files.length > 0 ? files.join('\n\n') : null;
}

/**
 * POST /api/projects/:id/source/ai-edit
 * AI-powered code editing: analyze, modify, explain, or refactor code
 *
 * Body: { action, filePath, selectedCode, instruction, fullFileContent }
 * Actions: 'edit' | 'explain' | 'refactor' | 'fix' | 'multi-edit'
 */
router.post('/:id/source/ai-edit', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { action, filePath, selectedCode, instruction, fullFileContent } = req.body;
        if (!action) return res.status(400).json({ error: 'action 파라미터가 필요합니다.' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);

        // Collect project context for AI
        const sourceContext = collectSourceContext(projectDir);

        // Build the prompt based on action
        let systemPrompt = `당신은 Orbitron AI 코드 엔지니어입니다. 프로젝트의 소스 코드를 분석하고 수정합니다.
항상 한국어로 설명하되, 코드는 원본 언어를 유지합니다.
프로젝트: ${project.name} (${project.type || 'web'})`;

        let userPrompt = '';

        if (action === 'edit' || action === 'fix' || action === 'refactor') {
            systemPrompt += `\n\n반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력합니다:
{
  "modified": "수정된 전체 코드 (선택 영역만)",
  "explanation": "변경 사항 한국어 설명 (1~3줄)",
  "changes": [
    { "description": "변경 1 설명" },
    { "description": "변경 2 설명" }
  ]
}`;
            const actionLabel = action === 'edit' ? '수정' : action === 'fix' ? '버그 수정' : '리팩토링';
            userPrompt = `파일: ${filePath}\n\n`;
            if (selectedCode) {
                userPrompt += `선택된 코드:\n\`\`\`\n${selectedCode}\n\`\`\`\n\n`;
            }
            if (fullFileContent) {
                userPrompt += `전체 파일 내용 (컨텍스트):\n\`\`\`\n${fullFileContent}\n\`\`\`\n\n`;
            }
            userPrompt += `요청: ${instruction || actionLabel + '해주세요'}\n\n`;
            userPrompt += `위 선택된 코드를 ${actionLabel}하여 modified 필드에 수정된 코드만 반환하세요.`;

        } else if (action === 'explain') {
            systemPrompt += `\n코드를 분석하고 한국어로 명확하게 설명합니다.`;
            userPrompt = `파일: ${filePath}\n\n코드:\n\`\`\`\n${selectedCode}\n\`\`\`\n\n이 코드를 상세히 설명해주세요. 역할, 로직 흐름, 주요 변수/함수의 목적을 설명합니다.`;

        } else if (action === 'multi-edit') {
            systemPrompt += `\n\n여러 파일을 동시에 수정합니다. 반드시 아래 JSON 형식으로만 응답하세요:
{
  "patches": [
    {
      "file": "상대 경로",
      "original": "원본 코드 조각",
      "modified": "수정된 코드 조각",
      "explanation": "변경 이유"
    }
  ],
  "summary": "전체 변경 요약 (한국어)"
}`;
            userPrompt = `프로젝트 소스 컨텍스트:\n${sourceContext || '(없음)'}\n\n요청: ${instruction}\n\n관련 파일들을 찾아서 필요한 모든 수정을 patches 배열로 반환하세요.`;

        } else if (action === 'generate') {
            systemPrompt += `\n\n새 코드를 생성합니다. 반드시 아래 JSON 형식으로만 응답하세요:
{
  "code": "생성된 코드",
  "explanation": "설명",
  "language": "언어"
}`;
            userPrompt = `파일: ${filePath || '(새 파일)'}\n\n`;
            if (fullFileContent) {
                userPrompt += `현재 파일 내용:\n\`\`\`\n${fullFileContent}\n\`\`\`\n\n`;
            }
            userPrompt += `요청: ${instruction}`;
        }

        // Call AI (try Claude first, then Gemini fallback)
        let aiResponse;
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (anthropicKey) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 45000);
                const resp = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': anthropicKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: project.ai_model || 'claude-sonnet-4-20250514',
                        max_tokens: 4096,
                        system: systemPrompt,
                        messages: [{ role: 'user', content: userPrompt }]
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeout);
                const data = await resp.json();
                aiResponse = data.content?.[0]?.text || data.error?.message || 'AI 응답 없음';
            } catch (e) {
                if (e.name === 'AbortError' && geminiKey) {
                    // Fallback to Gemini
                } else if (!geminiKey) {
                    return res.status(500).json({ error: `AI 호출 실패: ${e.message}` });
                }
            }
        }

        if (!aiResponse && geminiKey) {
            try {
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ parts: [{ text: userPrompt }] }],
                        generationConfig: { maxOutputTokens: 4096, temperature: 0.2 }
                    })
                });
                const data = await resp.json();
                aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Gemini 응답 없음';
            } catch (e) {
                return res.status(500).json({ error: `AI 호출 실패: ${e.message}` });
            }
        }

        if (!aiResponse) {
            return res.status(500).json({ error: 'AI API 키가 설정되지 않았습니다.' });
        }

        // Parse response based on action
        if (action === 'explain') {
            return res.json({ action, result: { explanation: aiResponse } });
        }

        // Try to parse JSON from response
        try {
            // Extract JSON from potential markdown code blocks
            let jsonStr = aiResponse;
            const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) jsonStr = jsonMatch[1];
            // Also try to find raw JSON
            const rawMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (rawMatch) jsonStr = rawMatch[0];

            const parsed = JSON.parse(jsonStr);
            return res.json({ action, result: parsed });
        } catch {
            // If JSON parse fails, return raw text
            return res.json({ action, result: { raw: aiResponse, explanation: aiResponse } });
        }

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/projects/:id/source/ai-apply
 * Apply AI-generated patches to files
 */
router.post('/:id/source/ai-apply', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { patches } = req.body;
        if (!patches || !Array.isArray(patches)) return res.status(400).json({ error: 'patches 배열이 필요합니다.' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        const results = [];

        for (const patch of patches) {
            const fullPath = path.join(projectDir, patch.file);
            if (!fullPath.startsWith(projectDir)) {
                results.push({ file: patch.file, success: false, error: '접근 거부' });
                continue;
            }
            try {
                if (!fs.existsSync(fullPath)) {
                    results.push({ file: patch.file, success: false, error: '파일 없음' });
                    continue;
                }
                let content = fs.readFileSync(fullPath, 'utf-8');
                if (patch.original && content.includes(patch.original)) {
                    content = content.replace(patch.original, patch.modified);
                    fs.writeFileSync(fullPath, content, 'utf-8');
                    results.push({ file: patch.file, success: true });
                } else if (patch.fullContent) {
                    // Full file replacement
                    fs.writeFileSync(fullPath, patch.fullContent, 'utf-8');
                    results.push({ file: patch.file, success: true });
                } else {
                    results.push({ file: patch.file, success: false, error: '원본 코드를 찾을 수 없음' });
                }
            } catch (e) {
                results.push({ file: patch.file, success: false, error: e.message });
            }
        }

        res.json({ results, applied: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
module.exports.collectSourceContext = collectSourceContext;
