// src/monitor/alertRules.js
// Alert rules engine for automated notifications
import logger from '../utils/logger.js';

const ALERT_RULES = [
    {
        id: 'disk_high',
        metric: 'disk_usage',
        threshold: 85,
        operator: '>=',
        severity: 'warning',
        message: '⚠️ 디스크 사용량 {value}% — 정리가 필요합니다',
    },
    {
        id: 'disk_critical',
        metric: 'disk_usage',
        threshold: 95,
        operator: '>=',
        severity: 'critical',
        message: '🔴 디스크 사용량 {value}% — 긴급 조치 필요!',
    },
    {
        id: 'memory_high',
        metric: 'memory_usage',
        threshold: 90,
        operator: '>=',
        severity: 'warning',
        message: '⚠️ 메모리 사용량 {value}% — 주의 필요',
    },
    {
        id: 'cpu_high',
        metric: 'cpu_usage',
        threshold: 90,
        operator: '>=',
        severity: 'warning',
        message: '⚠️ CPU 사용량 {value}% — 부하가 높습니다',
    },
    {
        id: 'container_down',
        metric: 'container_state',
        threshold: 'exited',
        operator: '==',
        severity: 'critical',
        message: '🔴 {project} 컨테이너가 중지되었습니다',
    },
];

class AlertEngine {
    constructor() {
        this.cooldowns = new Map();
        this.cooldownMs = parseInt(process.env.ALERT_COOLDOWN || '300000');
        this.alertHandlers = [];
    }

    // Register a handler for alerts
    onAlert(handler) {
        this.alertHandlers.push(handler);
    }

    // Check metrics against rules and fire alerts
    evaluate(metrics) {
        if (!metrics?.system) return [];

        const triggered = [];

        for (const rule of ALERT_RULES) {
            let value;
            let shouldAlert = false;

            switch (rule.metric) {
                case 'disk_usage':
                    value = metrics.system.disk?.usagePercent;
                    break;
                case 'memory_usage':
                    value = metrics.system.memory?.usagePercent;
                    break;
                case 'cpu_usage':
                    value = metrics.system.cpu?.usage;
                    break;
                case 'container_state':
                    // Check each orbitron container
                    if (metrics.containers) {
                        for (const c of metrics.containers) {
                            if (c.isOrbitron && c.state === 'exited') {
                                const alertId = `${rule.id}_${c.name}`;
                                if (!this._isCoolingDown(alertId)) {
                                    const alert = {
                                        ruleId: rule.id,
                                        severity: rule.severity,
                                        message: rule.message.replace('{project}', c.name.replace('orbitron-', '')),
                                        value: c.state,
                                        timestamp: new Date().toISOString(),
                                    };
                                    triggered.push(alert);
                                    this._setCooldown(alertId);
                                }
                            }
                        }
                    }
                    continue; // skip the generic comparison below
            }

            if (value !== undefined && !this._isCoolingDown(rule.id)) {
                if (rule.operator === '>=' && value >= rule.threshold) {
                    shouldAlert = true;
                } else if (rule.operator === '>' && value > rule.threshold) {
                    shouldAlert = true;
                }

                if (shouldAlert) {
                    const alert = {
                        ruleId: rule.id,
                        severity: rule.severity,
                        message: rule.message.replace('{value}', value),
                        value,
                        timestamp: new Date().toISOString(),
                    };
                    triggered.push(alert);
                    this._setCooldown(rule.id);
                }
            }
        }

        // Fire handlers
        for (const alert of triggered) {
            for (const handler of this.alertHandlers) {
                try {
                    handler(alert);
                } catch (err) {
                    logger.error('Alert', `Handler error: ${err.message}`);
                }
            }
        }

        return triggered;
    }

    _isCoolingDown(alertId) {
        const lastFired = this.cooldowns.get(alertId);
        if (!lastFired) return false;
        return (Date.now() - lastFired) < this.cooldownMs;
    }

    _setCooldown(alertId) {
        this.cooldowns.set(alertId, Date.now());
    }
}

export default new AlertEngine();
