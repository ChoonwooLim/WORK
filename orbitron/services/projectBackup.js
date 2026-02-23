const fs = require('fs');
const path = require('path');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');
const BACKUP_ROOT = '/mnt/341AFA2C1AF9EB2E/Projects';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', '.cache', 'dist', '__pycache__', '.nuxt', '.output']);

/**
 * Format byte size to human-readable string
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

/**
 * Recursively copy directory, skipping excluded dirs.
 * Returns { copiedCount, skippedCount, totalSize }
 */
function copyDirSync(srcDir, destDir) {
    let copiedCount = 0;
    let skippedCount = 0;
    let totalSize = 0;

    function walk(src, dest) {
        let entries;
        try {
            entries = fs.readdirSync(src, { withFileTypes: true });
        } catch (e) {
            return;
        }

        fs.mkdirSync(dest, { recursive: true });

        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) {
                skippedCount++;
                continue;
            }

            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                walk(srcPath, destPath);
            } else if (entry.isFile()) {
                try {
                    const srcStat = fs.statSync(srcPath);
                    totalSize += srcStat.size;

                    // Skip if dest file exists and is same size + newer
                    if (fs.existsSync(destPath)) {
                        const destStat = fs.statSync(destPath);
                        if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
                            skippedCount++;
                            continue;
                        }
                    }

                    fs.copyFileSync(srcPath, destPath);
                    copiedCount++;
                } catch (e) {
                    // Skip unreadable files
                }
            }
        }
    }

    walk(srcDir, destDir);
    return { copiedCount, skippedCount, totalSize };
}

/**
 * Backup entire project folder to DATA drive.
 * Excludes node_modules, .git, .next, etc.
 */
function backupProject(project) {
    const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
    if (!fs.existsSync(projectDir)) {
        throw new Error(`프로젝트 디렉토리가 존재하지 않습니다: ${projectDir}`);
    }

    // Ensure backup root exists
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });

    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);

    const result = copyDirSync(projectDir, backupDir);

    // Write manifest
    const manifest = {
        projectName: project.name,
        projectSubdomain: project.subdomain,
        sourceType: project.source_type || 'github',
        backupTime: new Date().toISOString(),
        sourceDir: projectDir,
        copiedCount: result.copiedCount,
        skippedCount: result.skippedCount,
        totalSize: result.totalSize,
        totalSizeFormatted: formatSize(result.totalSize),
    };

    fs.writeFileSync(
        path.join(backupDir, '_project_backup_manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
    );

    return {
        ...result,
        totalSizeFormatted: formatSize(result.totalSize),
        backupDir,
    };
}

/**
 * Get project backup status.
 */
function getProjectBackupStatus(project) {
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    const manifestPath = path.join(backupDir, '_project_backup_manifest.json');

    if (!fs.existsSync(manifestPath)) {
        return {
            exists: false,
            backupDir,
            lastBackupTime: null,
            totalSizeFormatted: '0 B',
        };
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        return {
            exists: true,
            backupDir,
            lastBackupTime: manifest.backupTime,
            copiedCount: manifest.copiedCount,
            totalSize: manifest.totalSize,
            totalSizeFormatted: manifest.totalSizeFormatted,
        };
    } catch (e) {
        return {
            exists: false,
            backupDir,
            lastBackupTime: null,
            totalSizeFormatted: '0 B',
            error: e.message,
        };
    }
}

/**
 * Restore project from backup to deployments directory.
 */
function restoreProject(project) {
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);

    if (!fs.existsSync(backupDir)) {
        throw new Error('백업이 존재하지 않습니다.');
    }

    const result = copyDirSync(backupDir, projectDir);

    // Remove manifest file from project dir if copied
    const manifestInProject = path.join(projectDir, '_project_backup_manifest.json');
    if (fs.existsSync(manifestInProject)) {
        fs.unlinkSync(manifestInProject);
    }

    return {
        ...result,
        totalSizeFormatted: formatSize(result.totalSize),
    };
}

module.exports = { backupProject, getProjectBackupStatus, restoreProject, formatSize, BACKUP_ROOT };
