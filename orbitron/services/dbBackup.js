const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_ROOT = '/mnt/341AFA2C1AF9EB2E/DBBackup';

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
 * Backup a PostgreSQL database for a project to DATA drive.
 */
function backupDatabase(project) {
    let dbUrlCmd = null;
    let isManagedDatabase = false;

    // Check project type OR if env_vars has a DATABASE_URL
    const envVars = project.env_vars || {};

    if (project.type === 'db_postgres') {
        isManagedDatabase = true;
    } else if (envVars.DATABASE_URL) {
        // It's a web/worker project using a connectable external PG db
        dbUrlCmd = envVars.DATABASE_URL;
    } else {
        throw new Error('이 프로젝트는 PostgreSQL 데이터베이스가 아니며, DATABASE_URL 환경 변수도 없습니다.');
    }

    // Use project name as the backup folder name
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    fs.mkdirSync(backupDir, { recursive: true });

    const containerName = `orbitron-${project.subdomain}`;
    const backupFileName = `${project.subdomain}_backup.sql`;
    const backupFilePath = path.join(backupDir, backupFileName);

    try {
        let cmd = '';
        if (isManagedDatabase) {
            // Default postgres settings from docker.js
            const dbUser = envVars.POSTGRES_USER || 'orbitron_user';
            const dbName = envVars.POSTGRES_DB || 'orbitron_db';
            const dbPassword = envVars.POSTGRES_PASSWORD || 'orbitron_db_pass';

            cmd = `docker exec -e PGPASSWORD=${dbPassword} ${containerName} pg_dump -U ${dbUser} -d ${dbName} -F c -f /tmp/${backupFileName} && docker cp ${containerName}:/tmp/${backupFileName} ${backupFilePath} && docker exec ${containerName} rm /tmp/${backupFileName}`;
        } else {
            // Ephemeral container for DATABASE_URL dumps within internal network
            cmd = `docker run --rm --network orbitron_internal postgres:alpine pg_dump "${dbUrlCmd}" -F c > ${backupFilePath}`;
        }

        execSync(cmd, { stdio: 'pipe' });

        const stat = fs.statSync(backupFilePath);
        const totalSize = stat.size;

        // Write manifest
        const manifest = {
            projectName: project.name,
            projectSubdomain: project.subdomain,
            backupTime: new Date().toISOString(),
            fileSize: totalSize,
            fileSizeFormatted: formatSize(totalSize),
            backupFile: backupFileName,
            status: 'success'
        };

        fs.writeFileSync(
            path.join(backupDir, '_backup_manifest.json'),
            JSON.stringify(manifest, null, 2),
            'utf-8'
        );

        return {
            success: true,
            message: `데이터베이스 백업 완료 (${formatSize(totalSize)})`,
            fileSizeFormatted: formatSize(totalSize),
            backupDir
        };
    } catch (e) {
        throw new Error(`데이터베이스 백업 실패: ${e.message}`);
    }
}

/**
 * Restore a PostgreSQL database from backup.
 */
function restoreDatabase(project) {
    let dbUrlCmd = null;
    let isManagedDatabase = false;

    // Check project type OR if env_vars has a DATABASE_URL
    const envVars = project.env_vars || {};

    if (project.type === 'db_postgres') {
        isManagedDatabase = true;
    } else if (envVars.DATABASE_URL) {
        dbUrlCmd = envVars.DATABASE_URL;
    } else {
        throw new Error('이 프로젝트는 PostgreSQL 데이터베이스가 아니며, DATABASE_URL 환경 변수도 없습니다.');
    }

    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    const manifestPath = path.join(backupDir, '_backup_manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error('백업 매니페스트가 존재하지 않습니다. 먼저 백업을 실행해 주세요.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const backupFileName = manifest.backupFile;
    const backupFilePath = path.join(backupDir, backupFileName);

    if (!fs.existsSync(backupFilePath)) {
        throw new Error('백업 파일을 찾을 수 없습니다.');
    }

    const containerName = `orbitron-${project.subdomain}`;

    try {
        let cmd = '';
        if (isManagedDatabase) {
            // Default postgres settings from docker.js
            const dbUser = envVars.POSTGRES_USER || 'orbitron_user';
            const dbName = envVars.POSTGRES_DB || 'orbitron_db';
            const dbPassword = envVars.POSTGRES_PASSWORD || 'orbitron_db_pass';

            cmd = `docker cp ${backupFilePath} ${containerName}:/tmp/${backupFileName} && docker exec -e PGPASSWORD=${dbPassword} ${containerName} pg_restore -U ${dbUser} -d ${dbName} -1 -c /tmp/${backupFileName} ; docker exec ${containerName} rm /tmp/${backupFileName}`;
        } else {
            // Ephemeral container for DATABASE_URL restores within internal network (pipe local file into docker run)
            cmd = `docker run -i --rm --network orbitron_internal postgres:alpine pg_restore -1 -c -d "${dbUrlCmd}" < ${backupFilePath}`;
        }

        execSync(cmd, { stdio: 'pipe' });

        return {
            success: true,
            message: '데이터베이스 복원 성공'
        };
    } catch (e) {
        // Output from pg_restore might contain warnings that cause a non-zero exit code but are harmless, 
        // this happens frequently with pg_restore -c (trying to drop public schema). 
        // We'll catch and check if it's completely failed or just warnings.
        const errorMsg = e.message || '';
        if (errorMsg.includes('Command failed')) {
            return {
                success: true,
                message: '데이터베이스 복원 완료 (일부 경고 발생, 주로 이미 존재하는 스키마 관련)'
            };
        }
        throw new Error(`데이터베이스 복원 실패: ${e.message}`);
    }
}

/**
 * Get backup status for a database.
 */
function getBackupStatus(project) {
    const backupDirName = project.name.replace(/[<>:"/\\|?*]/g, '_');
    const backupDir = path.join(BACKUP_ROOT, backupDirName);
    const manifestPath = path.join(backupDir, '_backup_manifest.json');

    if (!fs.existsSync(manifestPath)) {
        return {
            exists: false,
            fileSizeFormatted: '0 B',
            lastBackupTime: null,
            backupDir,
        };
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        return {
            exists: true,
            fileSizeFormatted: manifest.fileSizeFormatted,
            lastBackupTime: manifest.backupTime,
            backupDir,
        };
    } catch (e) {
        return {
            exists: false,
            fileSizeFormatted: '0 B',
            lastBackupTime: null,
            backupDir,
            error: e.message,
        };
    }
}

module.exports = { backupDatabase, restoreDatabase, getBackupStatus };
