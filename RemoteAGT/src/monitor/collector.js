// src/monitor/collector.js
// Collects system and Docker container metrics
import Dockerode from 'dockerode';
import si from 'systeminformation';
import logger from '../utils/logger.js';
import config from '../utils/config.js';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

class MetricCollector {
    constructor() {
        this.latestMetrics = {};
        this.intervalId = null;
    }

    // Get system metrics (CPU, RAM, Disk)
    async getSystemMetrics() {
        try {
            const [cpu, mem, disk, load] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize(),
                si.currentLoad(),
            ]);

            const rootDisk = disk.find(d => d.mount === '/') || disk[0] || {};

            return {
                cpu: {
                    usage: Math.round(cpu.currentLoad * 10) / 10,
                    cores: cpu.cpus?.length || 0,
                },
                memory: {
                    total: mem.total,
                    used: mem.used,
                    available: mem.available,
                    usagePercent: Math.round((mem.used / mem.total) * 1000) / 10,
                    totalGB: (mem.total / 1073741824).toFixed(1),
                    usedGB: (mem.used / 1073741824).toFixed(1),
                },
                disk: {
                    total: rootDisk.size || 0,
                    used: rootDisk.used || 0,
                    available: (rootDisk.size || 0) - (rootDisk.used || 0),
                    usagePercent: Math.round(rootDisk.use * 10) / 10 || 0,
                    totalGB: ((rootDisk.size || 0) / 1073741824).toFixed(1),
                    usedGB: ((rootDisk.used || 0) / 1073741824).toFixed(1),
                },
                uptime: process.uptime(),
            };
        } catch (err) {
            logger.error('Monitor', `System metrics error: ${err.message}`);
            return null;
        }
    }

    // Get all Docker containers status
    async getContainerMetrics() {
        try {
            const containers = await docker.listContainers({ all: true });
            const metrics = [];

            for (const c of containers) {
                const name = (c.Names?.[0] || '').replace(/^\//, '');
                const isOrbitron = name.startsWith('orbitron-');

                metrics.push({
                    id: c.Id.substring(0, 12),
                    name,
                    image: c.Image,
                    state: c.State,
                    status: c.Status,
                    isOrbitron,
                    ports: c.Ports?.map(p => `${p.PublicPort || '?'}:${p.PrivatePort}`).join(', ') || '',
                    created: new Date(c.Created * 1000).toISOString(),
                });
            }

            return metrics;
        } catch (err) {
            logger.error('Monitor', `Docker metrics error: ${err.message}`);
            return [];
        }
    }

    // Get stats for a specific container
    async getContainerStats(containerName) {
        try {
            const container = docker.getContainer(containerName);
            const stats = await container.stats({ stream: false });

            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
            const cpuPercent = systemDelta > 0 ? ((cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100) : 0;

            const memUsage = stats.memory_stats.usage || 0;
            const memLimit = stats.memory_stats.limit || 1;

            return {
                cpu: Math.round(cpuPercent * 10) / 10,
                memory: {
                    usage: memUsage,
                    limit: memLimit,
                    percent: Math.round((memUsage / memLimit) * 1000) / 10,
                    usageMB: (memUsage / 1048576).toFixed(1),
                },
            };
        } catch (err) {
            return null;
        }
    }

    // Collect all metrics and cache
    async collectAll() {
        const [system, containers] = await Promise.all([
            this.getSystemMetrics(),
            this.getContainerMetrics(),
        ]);

        this.latestMetrics = {
            system,
            containers,
            collectedAt: new Date().toISOString(),
        };

        return this.latestMetrics;
    }

    // Start periodic collection
    startPeriodicCollection(intervalMs) {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.collectAll(), intervalMs || config.monitor.collectInterval);
        // Collect immediately
        this.collectAll();
        logger.info('Monitor', `Periodic collection started (${(intervalMs || config.monitor.collectInterval) / 1000}s interval)`);
    }

    // Stop periodic collection
    stopPeriodicCollection() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // Get cached metrics
    getLatest() {
        return this.latestMetrics;
    }
}

export default new MetricCollector();
