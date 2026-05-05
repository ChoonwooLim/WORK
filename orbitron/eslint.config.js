// ESLint config — focuses on catching undefined references (the kind of bug
// that hid in routes/projects.js for 2 months: execSync used without import,
// silently swallowed by try-catch).
//
// Scope: server-side JS only (services/, routes/, db/, server.js).
// Frontend public/js/* is excluded for now (browser globals, vanilla JS).

const globals = {
    // Node built-ins / commonly used globals
    require: 'readonly',
    module: 'readonly',
    exports: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    process: 'readonly',
    console: 'readonly',
    Buffer: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    setImmediate: 'readonly',
    queueMicrotask: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    Promise: 'readonly',
    // Node 18+ globals
    fetch: 'readonly',
    AbortController: 'readonly',
    AbortSignal: 'readonly',
    Headers: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    FormData: 'readonly',
    Blob: 'readonly',
    File: 'readonly',
};

module.exports = [
    {
        files: ['services/**/*.js', 'routes/**/*.js', 'db/**/*.js', 'server.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals,
        },
        rules: {
            // ── Critical: catches the execSync-not-imported bug ──
            'no-undef': 'error',

            // ── Catch other common silent-failure bugs ──
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],  // try-catch with empty catch is intentional in this codebase
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-redeclare': 'error',

            // ── Style/safety (warnings only, not errors) ──
            'no-undef-init': 'warn',
        },
    },
    {
        ignores: [
            'node_modules/**',
            'deployments/**',
            'public/**',
            'uploads/**',
            'uploads_tmp/**',
            'logs/**',
            'venv/**',
            'old/**',
            'docs/**',
            '*.min.js',
            'test_flow.js',
            'update_openclaw_token.js',
            'scripts/**',
        ],
    },
];
