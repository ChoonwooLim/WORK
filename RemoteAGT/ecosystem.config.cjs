// ecosystem.config.cjs — PM2 Configuration
module.exports = {
    apps: [{
        name: 'remoteagt',
        script: 'server.js',
        cwd: '/home/stevenlim/WORK/RemoteAGT',
        node_args: '--experimental-vm-modules',
        env: {
            NODE_ENV: 'production',
            PORT: 4100,
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '512M',
        error_file: '/home/stevenlim/WORK/RemoteAGT/logs/error.log',
        out_file: '/home/stevenlim/WORK/RemoteAGT/logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }],
};
