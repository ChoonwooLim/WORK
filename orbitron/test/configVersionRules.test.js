'use strict';

// Pins for services/configVersionRules.js — the optimistic-locking judgement behind
// PUT /api/projects/:id `expected_config_version`. Pure functions only: NEVER touches
// DB or HTTP.

const test = require('node:test');
const assert = require('node:assert');

const { parseExpectedConfigVersion, classifyNoRowUpdate } = require('../services/configVersionRules');

test('absent expected version keeps the legacy unconditional update', () => {
    assert.deepStrictEqual(parseExpectedConfigVersion(undefined), { kind: 'absent' });
    assert.deepStrictEqual(parseExpectedConfigVersion(null), { kind: 'absent' });
});

test('positive integers (number or digit string) are accepted, everything else is invalid', () => {
    assert.deepStrictEqual(parseExpectedConfigVersion(7), { kind: 'expected', value: 7 });
    assert.deepStrictEqual(parseExpectedConfigVersion('12'), { kind: 'expected', value: 12 });
    for (const bad of [0, -1, 1.5, 'abc', '', '1.0', {}, [], true, NaN]) {
        assert.deepStrictEqual(parseExpectedConfigVersion(bad), { kind: 'invalid' }, `input: ${JSON.stringify(bad)}`);
    }
});

test('no-row update on a missing/unowned project is 404 even when a version was sent', () => {
    const expected = { kind: 'expected', value: 3 };
    assert.deepStrictEqual(classifyNoRowUpdate({ expected, exists: false, currentVersion: null }), { status: 404 });
});

test('no-row update on an existing project with a stale version is 409 carrying the current version', () => {
    const expected = { kind: 'expected', value: 3 };
    assert.deepStrictEqual(
        classifyNoRowUpdate({ expected, exists: true, currentVersion: 5 }),
        { status: 409, code: 'CONFIG_VERSION_MISMATCH', currentConfigVersion: 5 }
    );
});

test('no-row update without a version request is never reported as a conflict', () => {
    assert.deepStrictEqual(classifyNoRowUpdate({ expected: { kind: 'absent' }, exists: true, currentVersion: 5 }), { status: 404 });
});
