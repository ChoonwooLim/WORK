// src/gateways/telegram.js
// Telegram Bot Gateway using Grammy
import { Bot, InlineKeyboard } from 'grammy';
import config from '../utils/config.js';
import logger from '../utils/logger.js';
import userRegistry from '../auth/userRegistry.js';
import collector from '../monitor/collector.js';
import alertRules from '../monitor/alertRules.js';
import orbitronClient from '../bridge/orbitronClient.js';
import { formatStatus, formatHelp, formatContainerList, formatProjectList, formatDiskInfo } from '../notifications/formatter.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TelegramGateway {
    constructor() {
        this.bot = null;
        this.adminChatId = null;
    }

    // Initialize and start the bot
    async start() {
        if (!config.telegram.botToken) {
            logger.warn('Telegram', 'Bot token not configured — Telegram gateway disabled');
            return false;
        }

        this.bot = new Bot(config.telegram.botToken);
        this.adminChatId = config.telegram.adminId;

        // Register command handlers
        this._registerCommands();

        // Register alert handler to forward alerts to admin
        alertRules.onAlert((alert) => this._handleAlert(alert));

        // Start the bot
        try {
            await this.bot.api.setMyCommands([
                { command: 'start', description: '🚀 RemoteAGT 시작' },
                { command: 'status', description: '📊 시스템 상태 리포트' },
                { command: 'containers', description: '🐳 컨테이너 목록' },
                { command: 'projects', description: '📦 Orbitron 프로젝트 목록' },
                { command: 'deploy', description: '🚀 프로젝트 배포' },
                { command: 'logs', description: '📋 컨테이너 로그' },
                { command: 'disk', description: '💾 디스크 사용량' },
                { command: 'plan', description: '📖 프로젝트 구축계획서' },
                { command: 'help', description: '❓ 도움말' },
            ]);

            this.bot.start({
                onStart: () => {
                    logger.success('Telegram', 'Bot started and listening for messages');
                    // Notify admin
                    if (this.adminChatId) {
                        this.sendMessage(this.adminChatId, '🪐 *RemoteAGT 시작됨*\n\n시스템이 온라인 상태입니다. /help 를 입력하세요.');
                    }
                },
            });

            return true;
        } catch (err) {
            logger.error('Telegram', `Failed to start bot: ${err.message}`);
            return false;
        }
    }

    // Register all command handlers
    _registerCommands() {
        // /start
        this.bot.command('start', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            await ctx.reply(
                `🪐 *RemoteAGT에 오신 것을 환영합니다!*\n\n` +
                `모바일에서 Antigravity AI와 소통하고,\n` +
                `업무를 지시하며, 서버를 모니터링하세요.\n\n` +
                `/help 를 입력하면 사용 가능한 명령을 볼 수 있습니다.`,
                { parse_mode: 'Markdown' }
            );
        });

        // /help
        this.bot.command('help', async (ctx) => {
            await ctx.reply(formatHelp(), { parse_mode: 'Markdown' });
        });

        // /status
        this.bot.command('status', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            await ctx.reply('⏳ 시스템 상태를 수집 중...');
            const metrics = await collector.collectAll();
            const message = formatStatus(metrics);
            await ctx.reply(message, { parse_mode: 'Markdown' });
        });

        // /containers
        this.bot.command('containers', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            const metrics = await collector.collectAll();
            await ctx.reply(formatContainerList(metrics.containers), { parse_mode: 'Markdown' });
        });

        // /disk
        this.bot.command('disk', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            const metrics = await collector.collectAll();
            await ctx.reply(formatDiskInfo(metrics.system), { parse_mode: 'Markdown' });
        });

        // /projects
        this.bot.command('projects', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            await ctx.reply('⏳ Orbitron 프로젝트 조회 중...');
            const projects = await orbitronClient.getProjects();
            await ctx.reply(formatProjectList(projects), { parse_mode: 'Markdown' });
        });

        // /deploy <project>
        this.bot.command('deploy', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            const projectName = ctx.match?.trim();
            if (!projectName) {
                await ctx.reply('⚠️ 사용법: /deploy <프로젝트명>\n\n/projects 로 프로젝트 목록을 확인하세요.');
                return;
            }

            await ctx.reply(`🔍 "${projectName}" 프로젝트를 찾는 중...`);
            const project = await orbitronClient.findProject(projectName);

            if (!project) {
                await ctx.reply(`❌ "${projectName}" 프로젝트를 찾을 수 없습니다.\n\n/projects 로 목록을 확인하세요.`);
                return;
            }

            await ctx.reply(`🚀 *${project.name}* 배포를 시작합니다...`, { parse_mode: 'Markdown' });

            try {
                const result = await orbitronClient.deployProject(project.id);
                if (result?.error) {
                    await ctx.reply(`❌ 배포 실패: ${result.error}`);
                } else {
                    await ctx.reply(
                        `✅ *${project.name}* 배포가 시작되었습니다!\n\n` +
                        `🔗 ${project.tunnel_url || `https://${project.subdomain}.twinverse.org`}\n\n` +
                        `배포 진행 상황은 알림으로 전송됩니다.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } catch (err) {
                await ctx.reply(`❌ 배포 오류: ${err.message}`);
            }

            await userRegistry.logAudit(user.id, 'deploy', { project: project.name });
        });

        // /logs <project>
        this.bot.command('logs', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            const projectName = ctx.match?.trim();
            if (!projectName) {
                await ctx.reply('⚠️ 사용법: /logs <프로젝트명>');
                return;
            }

            const project = await orbitronClient.findProject(projectName);
            if (!project) {
                await ctx.reply(`❌ "${projectName}" 프로젝트를 찾을 수 없습니다.`);
                return;
            }

            try {
                const containerName = `orbitron-${project.subdomain}`;
                const { stdout } = await execAsync(`docker logs --tail 30 ${containerName} 2>&1`);
                const logs = stdout.trim() || '(빈 로그)';
                await ctx.reply(`📋 *${project.name} 로그* (최근 30줄)\n\n\`\`\`\n${logs.substring(0, 3500)}\n\`\`\``, { parse_mode: 'Markdown' });
            } catch (err) {
                await ctx.reply(`❌ 로그 조회 실패: ${err.message}`);
            }
        });

        // /plan — Show project plan document
        this.bot.command('plan', async (ctx) => {
            await ctx.reply(
                `📖 *RemoteAGT 구축계획서*\n\n` +
                `웹 대시보드에서 전체 계획서를 확인하세요:\n` +
                `🔗 http://localhost:${config.port}/plan\n\n` +
                `주요 내용:\n` +
                `• 시스템 아키텍처 (SNS Gateway → Antigravity)\n` +
                `• 핵심 모듈 6개 (Gateway, Auth, Parser, Queue, Monitor, Notifier)\n` +
                `• 기술 스택 (Node.js, Grammy, BullMQ, Redis, PostgreSQL)\n` +
                `• 4단계 개발 로드맵\n` +
                `• Orbitron 통합 아키텍처`,
                { parse_mode: 'Markdown' }
            );
        });

        // /uptime
        this.bot.command('uptime', async (ctx) => {
            const uptime = process.uptime();
            const h = Math.floor(uptime / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const s = Math.floor(uptime % 60);
            await ctx.reply(`⏱ *RemoteAGT 가동 시간*: ${h}시간 ${m}분 ${s}초`, { parse_mode: 'Markdown' });
        });

        // Catch-all for natural language messages
        this.bot.on('message:text', async (ctx) => {
            const user = await this._ensureUser(ctx);
            if (!user) return;

            const text = ctx.message.text;

            // Simple natural language intent detection
            if (text.includes('상태') || text.includes('status')) {
                const metrics = await collector.collectAll();
                await ctx.reply(formatStatus(metrics), { parse_mode: 'Markdown' });
            } else if (text.includes('배포') && text.includes('해')) {
                await ctx.reply('🚀 배포하려면 /deploy <프로젝트명> 을 사용하세요.\n/projects 로 목록을 확인할 수 있습니다.');
            } else if (text.includes('도움') || text.includes('help')) {
                await ctx.reply(formatHelp(), { parse_mode: 'Markdown' });
            } else {
                await ctx.reply(
                    `🤖 알 수 없는 명령입니다.\n\n` +
                    `/help 를 입력하면 사용 가능한 명령을 볼 수 있습니다.\n\n` +
                    `💡 자연어 명령은 Phase 2에서 지원됩니다.`
                );
            }
        });

        // Error handler
        this.bot.catch((err) => {
            logger.error('Telegram', `Bot error: ${err.message}`);
        });
    }

    // Ensure user is registered and authorized
    async _ensureUser(ctx) {
        const telegramUser = ctx.from;
        if (!telegramUser) return null;

        const platformUserId = String(telegramUser.id);

        // Auto-register admin
        if (this.adminChatId && platformUserId === this.adminChatId) {
            const user = await userRegistry.registerUser(
                'telegram',
                platformUserId,
                telegramUser.username || telegramUser.first_name || 'Admin'
            );
            if (user.auth_level < 3) {
                await userRegistry.setAuthLevel(user.id, 3);
                user.auth_level = 3;
            }
            return user;
        }

        // Check if user is authorized
        let user = await userRegistry.isAuthorized('telegram', platformUserId);
        if (!user) {
            // Auto-register with level 1 (read-only) for now
            user = await userRegistry.registerUser(
                'telegram',
                platformUserId,
                telegramUser.username || telegramUser.first_name || 'Unknown'
            );
        }

        return user;
    }

    // Handle alert notifications
    async _handleAlert(alert) {
        if (!this.adminChatId || !this.bot) return;

        try {
            await this.sendMessage(this.adminChatId, `${alert.message}\n⏰ ${alert.timestamp}`);
        } catch (err) {
            logger.error('Telegram', `Failed to send alert: ${err.message}`);
        }
    }

    // Send a message to a specific chat
    async sendMessage(chatId, text, options = {}) {
        if (!this.bot) return;
        try {
            await this.bot.api.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                ...options,
            });
        } catch (err) {
            logger.error('Telegram', `Send message failed: ${err.message}`);
        }
    }

    // Stop the bot
    async stop() {
        if (this.bot) {
            await this.bot.stop();
            logger.info('Telegram', 'Bot stopped');
        }
    }
}

export default new TelegramGateway();
