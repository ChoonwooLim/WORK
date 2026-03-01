const db = require('../db/db');

class ErrorKnowledge {

    /**
     * Save a resolved error as knowledge
     * @param {Object} params
     * @param {string} params.errorMessage - Original error log/message
     * @param {string} params.rootCause - What caused the error
     * @param {string} params.solution - How it was fixed (description)
     * @param {Array} params.patches - Array of { file, original, modified, explanation }
     * @param {string} params.projectType - 'web', 'python', 'static', etc.
     * @param {string} params.source - 'auto_repair', 'chat_fix', 'manual'
     * @param {number} params.projectId - Project ID (optional)
     */
    async saveKnowledge({ errorMessage, rootCause, solution, patches = [], projectType = 'web', source = 'auto_repair', projectId = null }) {
        try {
            // Extract error pattern (key phrases for future matching)
            const errorPattern = this.extractErrorPattern(errorMessage);

            if (!errorPattern || !rootCause || !solution) {
                console.log('[ErrorKnowledge] Skipping save: missing required fields');
                return null;
            }

            // Check if a very similar pattern already exists
            const existing = await db.queryOne(
                `SELECT id, success_count FROM error_knowledge 
                 WHERE error_pattern = $1 AND root_cause = $2
                 LIMIT 1`,
                [errorPattern, rootCause]
            );

            if (existing) {
                // Increment success count instead of duplicating
                await db.query(
                    `UPDATE error_knowledge SET success_count = success_count + 1, updated_at = NOW() WHERE id = $1`,
                    [existing.id]
                );
                console.log(`[ErrorKnowledge] Updated existing knowledge #${existing.id} (success_count: ${existing.success_count + 1})`);
                return existing.id;
            }

            // Save new knowledge entry
            const result = await db.queryOne(
                `INSERT INTO error_knowledge (error_pattern, error_message, root_cause, solution, patches, project_type, source, project_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [errorPattern, errorMessage.substring(0, 5000), rootCause, solution, JSON.stringify(patches), projectType, source, projectId]
            );

            console.log(`[ErrorKnowledge] ✅ Saved new knowledge #${result.id}: "${errorPattern}"`);
            return result.id;
        } catch (error) {
            console.error('[ErrorKnowledge] Save failed:', error.message);
            return null;
        }
    }

    /**
     * Find similar past error solutions based on the current error log
     * Returns up to 3 most relevant past solutions, ordered by relevance
     */
    async findSimilar(errorLog, projectType = null) {
        try {
            const keywords = this.extractSearchKeywords(errorLog);
            if (keywords.length === 0) return [];

            // Build a search query using ILIKE for each keyword
            // Score = number of matching keywords + success_count bonus
            const conditions = keywords.map((_, i) => `error_pattern ILIKE $${i + 1}`);
            const params = keywords.map(k => `%${k}%`);

            let query = `
                SELECT id, error_pattern, root_cause, solution, patches, project_type, success_count,
                       (${conditions.map(c => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(' + ')}) as relevance
                FROM error_knowledge
                WHERE (${conditions.join(' OR ')})`;

            if (projectType) {
                params.push(projectType);
                query += ` AND (project_type = $${params.length} OR project_type = 'web')`;
            }

            query += ` ORDER BY relevance DESC, success_count DESC LIMIT 3`;

            const results = await db.queryAll(query, params);

            if (results.length > 0) {
                console.log(`[ErrorKnowledge] Found ${results.length} similar past solutions`);
            }
            return results;
        } catch (error) {
            console.error('[ErrorKnowledge] Search failed:', error.message);
            return [];
        }
    }

    /**
     * Extract a normalized error pattern from a log for storage
     * e.g., "Module not found: express" → "module_not_found:express"
     */
    extractErrorPattern(log) {
        if (!log) return '';
        const lines = log.split('\n');

        // Find the most significant error line
        const errorPatterns = /error|ERR!|failed|FATAL|exception|Cannot find|Module not found|ENOENT|EACCES|ECONNREFUSED|exit code|SyntaxError|TypeError|ReferenceError/i;
        let errorLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (errorPatterns.test(lines[i])) {
                errorLine = lines[i].trim();
                break;
            }
        }

        if (!errorLine && lines.length > 0) {
            errorLine = lines[lines.length - 1].trim();
        }

        // Normalize: remove timestamps, paths specifics, keep error type + key module
        return errorLine
            .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*[Z]?/g, '') // timestamps
            .replace(/\/[^\s:]+\//g, '/') // simplify paths
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500);
    }

    /**
     * Extract search keywords from an error log for similarity matching
     */
    extractSearchKeywords(log) {
        if (!log) return [];

        const keywords = new Set();

        // Known error type patterns
        const patterns = [
            /Module not found[:\s]*['"]?([a-zA-Z0-9@/._-]+)/gi,
            /Cannot find module\s+['"]([^'"]+)/gi,
            /ENOENT[:\s]*.*?['"]([^'"]+)/gi,
            /EADDRINUSE[:\s]*.*?(\d+)/gi,
            /ECONNREFUSED/gi,
            /SyntaxError[:\s]*(.+?)(?:\n|$)/gi,
            /TypeError[:\s]*(.+?)(?:\n|$)/gi,
            /Error[:\s]*(.+?)(?:\n|$)/gi,
            /ERR![:\s]*(.+?)(?:\n|$)/gi,
            /exit code (\d+)/gi,
            /failed with exit code/gi,
            /Permission denied/gi,
            /OOMKilled/gi,
            /COPY failed/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(log)) !== null) {
                const keyword = (match[1] || match[0]).trim().substring(0, 100);
                if (keyword.length > 2) {
                    keywords.add(keyword);
                }
            }
        }

        // Also add generic error category keywords
        if (/Dockerfile/i.test(log)) keywords.add('Dockerfile');
        if (/docker.compose/i.test(log)) keywords.add('docker-compose');
        if (/npm ERR/i.test(log)) keywords.add('npm');
        if (/pip|requirements\.txt/i.test(log)) keywords.add('pip');
        if (/prisma/i.test(log)) keywords.add('prisma');
        if (/next/i.test(log) && /build/i.test(log)) keywords.add('nextjs');

        return Array.from(keywords).slice(0, 8); // Max 8 keywords
    }

    /**
     * Format knowledge entries as context for AI prompt injection
     */
    formatForPrompt(knowledgeEntries) {
        if (!knowledgeEntries || knowledgeEntries.length === 0) return '';

        let context = '\n## 📚 과거 유사 에러 해결 사례 (경험 DB)\n';
        context += '> 아래는 과거에 성공적으로 해결된 유사한 에러 사례입니다. 이를 참고하여 더 정확한 진단을 하세요.\n\n';

        for (let i = 0; i < knowledgeEntries.length; i++) {
            const k = knowledgeEntries[i];
            context += `### 사례 ${i + 1} (성공 ${k.success_count}회)\n`;
            context += `- **에러 패턴**: ${k.error_pattern}\n`;
            context += `- **원인**: ${k.root_cause}\n`;
            context += `- **해결법**: ${k.solution}\n`;
            if (k.patches && Array.isArray(k.patches) && k.patches.length > 0) {
                const patches = typeof k.patches === 'string' ? JSON.parse(k.patches) : k.patches;
                for (const p of patches) {
                    context += `  - \`${p.file}\`: ${p.explanation || ''}\n`;
                }
            }
            context += '\n';
        }

        return context;
    }

    /**
     * Get all knowledge entries (for admin dashboard)
     */
    async getAllKnowledge(limit = 50) {
        try {
            return await db.queryAll(
                `SELECT ek.*, p.name as project_name 
                 FROM error_knowledge ek 
                 LEFT JOIN projects p ON ek.project_id = p.id
                 ORDER BY ek.success_count DESC, ek.updated_at DESC 
                 LIMIT $1`,
                [limit]
            );
        } catch (error) {
            console.error('[ErrorKnowledge] Query failed:', error.message);
            return [];
        }
    }
}

module.exports = new ErrorKnowledge();
