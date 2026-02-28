// src/utils/logger.js
// Structured logging utility with emoji prefixes
import chalk from 'chalk';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;

function timestamp() {
    return new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function formatMessage(level, prefix, module, message, meta) {
    const ts = chalk.gray(`[${timestamp()}]`);
    const mod = module ? chalk.cyan(`[${module}]`) : '';
    const metaStr = meta ? ` ${chalk.gray(JSON.stringify(meta))}` : '';
    return `${ts} ${prefix} ${mod} ${message}${metaStr}`;
}

const logger = {
    debug(module, message, meta) {
        if (currentLevel <= LEVELS.debug) {
            console.log(formatMessage('debug', chalk.gray('🔍'), module, message, meta));
        }
    },

    info(module, message, meta) {
        if (currentLevel <= LEVELS.info) {
            console.log(formatMessage('info', '✅', module, message, meta));
        }
    },

    warn(module, message, meta) {
        if (currentLevel <= LEVELS.warn) {
            console.warn(formatMessage('warn', '⚠️', module, chalk.yellow(message), meta));
        }
    },

    error(module, message, meta) {
        if (currentLevel <= LEVELS.error) {
            console.error(formatMessage('error', '❌', module, chalk.red(message), meta));
        }
    },

    success(module, message, meta) {
        console.log(formatMessage('info', '🎉', module, chalk.green(message), meta));
    },

    system(message) {
        console.log(chalk.magenta(`\n🪐 ${message}\n`));
    },
};

export default logger;
