'use strict';

// Optimistic locking for PUT /api/projects/:id (pure — no DB, no HTTP, no side effects).
//
// Why: the provisioner and the dashboard both rewrite `env_vars` with a whole-object
// PUT. Without a version check the later writer silently discards the earlier one.
// `expected_config_version` is optional so the dashboard UI (which never sends it)
// keeps its exact old behaviour; when present it must be a positive integer and the
// route folds it into the UPDATE's WHERE clause so check and write are one statement.

function parseExpectedConfigVersion(raw) {
    if (raw === undefined || raw === null) return { kind: 'absent' };
    let n = NaN;
    if (typeof raw === 'number') n = raw;
    else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) n = Number(raw.trim());
    if (!Number.isInteger(n) || n < 1) return { kind: 'invalid' };
    return { kind: 'expected', value: n };
}

// After `UPDATE ... WHERE <owner scope> [AND config_version = expected]` returned no
// row: decide between "not found" (404 — existence must not leak) and "someone else
// changed the config first" (409 with the current version so the caller can re-read,
// re-merge and retry).
function classifyNoRowUpdate({ expected, exists, currentVersion }) {
    if (!exists) return { status: 404 };
    if (expected && expected.kind === 'expected' && currentVersion !== expected.value) {
        return { status: 409, code: 'CONFIG_VERSION_MISMATCH', currentConfigVersion: currentVersion };
    }
    return { status: 404 };
}

module.exports = { parseExpectedConfigVersion, classifyNoRowUpdate };
