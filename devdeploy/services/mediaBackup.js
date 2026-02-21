const fs = require('fs');
const path = require('path');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');
const BACKUP_ROOT = '/mnt/341AFA2C1AF9EB2E/MediaBackUp';

const MEDIA_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff',
    '.mp4', '.webm', '.avi', '.mov', '.mkv',
    '.mp3', '.wav', '.ogg', '.flac',
    '.pdf', '.pptx', '.ppt', '.doc', '.docx', '.xls', '.xlsx',
]);

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', '.cache', 'dist', '__pycache__']);

/**
 * Recursively scan a directory for media files.
 * Returns array of { relativePath, absolutePath, size, mtime }
 */
function scanMediaFiles(baseDir) {
    const results = [];

    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            return; // skip unreadable dirs
        }
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (MEDIA_EXTENSIONS.has(ext)) {
                    try {
                        const stat = fs.statSync(fullPath);
                        results.push({
                            relativePath: path.relative(baseDir, fullPath),
                            absolutePath: fullPath,
                            size: stat.size,
                            mtime: stat.mtime.toISOString(),
                        });
                    } catch (e) { /* skip unreadable files */ }
                }
            }
        }
    }

    walk(baseDir);
    return results;
}

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
 * Copy a file, creating parent directories as needed
 */
function copyFileSync(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

/**
 * Backup all media files for a project to DATA drive.
 * Returns { fileCount, totalSize, totalSizeFormatted, backupDir, skipped }
 */
function backupMedia(project) {
    const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
    if (!fs.existsSync(projectDir)) {
        throw new Error(`프로젝트 디렉토리가 존재하지 않습니다: ${projectDir}`);
    }

    // Use project name as the backup folder name
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    fs.mkdirSync(backupDir, { recursive: true });

    const mediaFiles = scanMediaFiles(projectDir);
    let copiedCount = 0;
    let skippedCount = 0;
    let totalSize = 0;
    const manifestEntries = [];

    for (const file of mediaFiles) {
        const destPath = path.join(backupDir, file.relativePath);
        totalSize += file.size;

        // Skip if backup file exists and is same size (unchanged)
        try {
            if (fs.existsSync(destPath)) {
                const destStat = fs.statSync(destPath);
                if (destStat.size === file.size) {
                    skippedCount++;
                    manifestEntries.push({
                        relativePath: file.relativePath,
                        size: file.size,
                        mtime: file.mtime,
                        status: 'unchanged',
                    });
                    continue;
                }
            }
        } catch (e) { /* proceed to copy */ }

        try {
            copyFileSync(file.absolutePath, destPath);
            copiedCount++;
            manifestEntries.push({
                relativePath: file.relativePath,
                size: file.size,
                mtime: file.mtime,
                status: 'copied',
            });
        } catch (e) {
            manifestEntries.push({
                relativePath: file.relativePath,
                size: file.size,
                mtime: file.mtime,
                status: 'error',
                error: e.message,
            });
        }
    }

    // Write manifest
    const manifest = {
        projectName: project.name,
        projectSubdomain: project.subdomain,
        backupTime: new Date().toISOString(),
        sourceDir: projectDir,
        fileCount: mediaFiles.length,
        copiedCount,
        skippedCount,
        totalSize,
        totalSizeFormatted: formatSize(totalSize),
        files: manifestEntries,
    };

    fs.writeFileSync(
        path.join(backupDir, '_backup_manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
    );

    return {
        fileCount: mediaFiles.length,
        copiedCount,
        skippedCount,
        totalSize,
        totalSizeFormatted: formatSize(totalSize),
        backupDir,
    };
}

/**
 * Restore media files from backup to original project directory.
 * If targetFile is specified, restore only that file.
 * Returns { restoredCount, skippedCount, errors }
 */
function restoreMedia(project, targetFile = null) {
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    const manifestPath = path.join(backupDir, '_backup_manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error('백업 매니페스트가 존재하지 않습니다. 먼저 백업을 실행해 주세요.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
    let restoredCount = 0;
    let skippedCount = 0;
    const errors = [];

    const filesToRestore = targetFile
        ? manifest.files.filter(f => f.relativePath === targetFile)
        : manifest.files;

    if (targetFile && filesToRestore.length === 0) {
        throw new Error(`백업에서 해당 파일을 찾을 수 없습니다: ${targetFile}`);
    }

    for (const file of filesToRestore) {
        if (file.status === 'error') {
            skippedCount++;
            continue;
        }

        const backupFilePath = path.join(backupDir, file.relativePath);
        const originalFilePath = path.join(projectDir, file.relativePath);

        if (!fs.existsSync(backupFilePath)) {
            errors.push({ file: file.relativePath, error: '백업 파일이 존재하지 않습니다' });
            continue;
        }

        try {
            copyFileSync(backupFilePath, originalFilePath);
            restoredCount++;
        } catch (e) {
            errors.push({ file: file.relativePath, error: e.message });
        }
    }

    return { restoredCount, skippedCount, errors, totalFiles: filesToRestore.length };
}

/**
 * Get backup status for a project.
 * Returns { exists, fileCount, totalSize, totalSizeFormatted, lastBackupTime, backupDir }
 */
function getBackupStatus(project) {
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    const manifestPath = path.join(backupDir, '_backup_manifest.json');

    if (!fs.existsSync(manifestPath)) {
        return {
            exists: false,
            fileCount: 0,
            totalSize: 0,
            totalSizeFormatted: '0 B',
            lastBackupTime: null,
            backupDir,
        };
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        return {
            exists: true,
            fileCount: manifest.fileCount,
            totalSize: manifest.totalSize,
            totalSizeFormatted: manifest.totalSizeFormatted,
            lastBackupTime: manifest.backupTime,
            backupDir,
        };
    } catch (e) {
        return {
            exists: false,
            fileCount: 0,
            totalSize: 0,
            totalSizeFormatted: '0 B',
            lastBackupTime: null,
            backupDir,
            error: e.message,
        };
    }
}

module.exports = { scanMediaFiles, backupMedia, restoreMedia, getBackupStatus, formatSize, BACKUP_ROOT };
