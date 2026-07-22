'use strict';

// Tests for one-click rollback (Task 2.1).
//
// Pins:
//   1. 롤백 자격 판정(assessRollbackEligibility): status/image_tag/project 소속 검증,
//      태그 형식 재검증 (DB 오염값이 docker CLI 로 흘러가지 않도록)
//   2. 롤백 commit_message 포맷: ⏪ rollback to d<id> (<원본 truncated>)
//   3. keep-list 기반 prune 규칙 (selectDeployTagsToRemove 3번째 인자):
//      - 롤백으로 다시 프로덕션이 된 OLD 태그는 id 순으로 밀려도 보존
//      - 실패 배포가 남긴 태그는 최신이어도 제거
//      - 빈/무효 keep-list 는 위치 기반 최신-N 규칙으로 안전 폴백
//   4. buildKeepTagList: 성공 배포 행 + 현재 태그 → 중복 없는 보존 목록
//
// NEVER invokes docker/DB — 순수 함수만 검증. deployer.rollbackTo 의 오케스트레이션
// (docker image inspect, 행 생성, 락)과 라우트는 Express/DB 없이 검증 불가 → 미커버.

const test = require('node:test');
const assert = require('node:assert');

const { assessRollbackEligibility, formatRollbackCommitMessage, buildKeepTagList } = require('../services/rollbackRules');
const docker = require('../services/docker');

// ── 1. Rollback eligibility ──────────────────────────────────────────────────

const PROJECT = { id: 5, subdomain: 'myapp' };
const GOOD_DEPLOYMENT = { id: 42, project_id: 5, status: 'success', image_tag: 'orbitron-myapp:d42' };

test('eligibility: successful deployment with valid tag is ok', () => {
    assert.deepStrictEqual(assessRollbackEligibility(PROJECT, GOOD_DEPLOYMENT), { ok: true });
});

test('eligibility: pg 문자열/숫자 id 혼재 허용 (project.id number vs project_id string)', () => {
    const dep = { ...GOOD_DEPLOYMENT, project_id: '5' };
    assert.strictEqual(assessRollbackEligibility(PROJECT, dep).ok, true);
});

test('eligibility: missing deployment → NOT_FOUND', () => {
    const r = assessRollbackEligibility(PROJECT, null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'NOT_FOUND');
});

test('eligibility: deployment of another project → WRONG_PROJECT', () => {
    const r = assessRollbackEligibility(PROJECT, { ...GOOD_DEPLOYMENT, project_id: 6 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'WRONG_PROJECT');
});

test('eligibility: non-success statuses → NOT_SUCCESS (failed, building, queued)', () => {
    for (const status of ['failed', 'building', 'queued']) {
        const r = assessRollbackEligibility(PROJECT, { ...GOOD_DEPLOYMENT, status });
        assert.strictEqual(r.ok, false, `status=${status}`);
        assert.strictEqual(r.code, 'NOT_SUCCESS');
        assert.ok(r.error.includes(status), 'error message names the actual status');
    }
});

test('eligibility: NULL/empty image_tag → NO_IMAGE_TAG (compose/db/vps or pre-tagging)', () => {
    for (const image_tag of [null, undefined, '']) {
        const r = assessRollbackEligibility(PROJECT, { ...GOOD_DEPLOYMENT, image_tag });
        assert.strictEqual(r.ok, false);
        assert.strictEqual(r.code, 'NO_IMAGE_TAG');
    }
});

test('eligibility: malformed image_tag → INVALID_TAG (docker CLI 오염 방지)', () => {
    const bad = [
        'orbitron-myapp:latest',        // d-태그 아님
        'orbitron-myapp:d0',            // 0 은 유효 배포 id 아님
        'orbitron-myapp:d1x',           // 숫자 뒤 잡음
        'evil; rm -rf /:d3',            // 셸 오염 시도
        'orbitron-MyApp:d3',            // 대문자 subdomain 불허
        ':d3',
    ];
    for (const image_tag of bad) {
        const r = assessRollbackEligibility(PROJECT, { ...GOOD_DEPLOYMENT, image_tag });
        assert.strictEqual(r.ok, false, `tag=${image_tag}`);
        assert.strictEqual(r.code, 'INVALID_TAG', `tag=${image_tag}`);
    }
});

test('eligibility: 순서 — 상태 검증이 태그 검증보다 먼저 (failed+null tag → NOT_SUCCESS)', () => {
    const r = assessRollbackEligibility(PROJECT, { ...GOOD_DEPLOYMENT, status: 'failed', image_tag: null });
    assert.strictEqual(r.code, 'NOT_SUCCESS');
});

// ── 2. Rollback commit message ───────────────────────────────────────────────

test('commit message: ⏪ rollback to d<id> (<original>)', () => {
    assert.strictEqual(
        formatRollbackCommitMessage({ id: 42, commit_message: 'fix: login bug' }),
        '⏪ rollback to d42 (fix: login bug)'
    );
});

test('commit message: no original message → bare form', () => {
    assert.strictEqual(formatRollbackCommitMessage({ id: 7, commit_message: null }), '⏪ rollback to d7');
    assert.strictEqual(formatRollbackCommitMessage({ id: 7, commit_message: '   ' }), '⏪ rollback to d7');
});

test('commit message: long original truncated to maxLen with ellipsis', () => {
    const long = 'a'.repeat(200);
    const msg = formatRollbackCommitMessage({ id: 3, commit_message: long });
    assert.ok(msg.startsWith('⏪ rollback to d3 ('));
    assert.ok(msg.endsWith('…)'));
    // 괄호 안 내용은 정확히 maxLen(기본 80)자: 79자 원문 + '…'
    const inner = msg.slice('⏪ rollback to d3 ('.length, -1);
    assert.strictEqual(inner.length, 80);
    assert.strictEqual(inner, 'a'.repeat(79) + '…');
});

test('commit message: exactly-maxLen original is not truncated', () => {
    const exact = 'b'.repeat(80);
    assert.strictEqual(
        formatRollbackCommitMessage({ id: 3, commit_message: exact }),
        `⏪ rollback to d3 (${exact})`
    );
});

// ── 3. Keep-list prune rule ──────────────────────────────────────────────────

test('prune: 롤백된 OLD 태그(d3)는 keep-list 로 보존, 실패 배포 태그(d8)는 최신이어도 제거', () => {
    // 시나리오: 성공 d3, d7, d9 + 실패 d8 이 남긴 태그 + 롤백으로 현재 프로덕션 = d3.
    // DB 조립 keep-list = 최신 3개 성공 image_tag {d3(롤백행), d9, d7} + 현재 태그 d3.
    const onDisk = ['orbitron-x:d3', 'orbitron-x:d7', 'orbitron-x:d8', 'orbitron-x:d9', 'orbitron-x:latest'];
    const keepTags = ['orbitron-x:d3', 'orbitron-x:d9', 'orbitron-x:d7'];
    assert.deepStrictEqual(
        docker.selectDeployTagsToRemove(onDisk, 3, keepTags),
        ['orbitron-x:d8']
    );
});

test('prune: keep-list 는 위치 규칙을 완전히 대체 (목록 밖 태그는 모두 제거, latest 는 불가침)', () => {
    const onDisk = ['orbitron-x:d1', 'orbitron-x:d2', 'orbitron-x:d3', 'orbitron-x:latest'];
    assert.deepStrictEqual(
        docker.selectDeployTagsToRemove(onDisk, 3, ['orbitron-x:d2']),
        ['orbitron-x:d3', 'orbitron-x:d1'] // 신규순 정렬 유지, d2 만 생존
    );
});

test('prune: keep-list 가 null/빈 배열이면 기존 최신-N 위치 규칙으로 폴백 (하위 호환 + 전량삭제 방지)', () => {
    const onDisk = ['orbitron-x:d9', 'orbitron-x:d10', 'orbitron-x:latest', 'orbitron-x:d11', 'orbitron-x:d2'];
    // null → 기존 2-인자 동작과 동일 (dockerBuild.test.js 핀과 일치)
    assert.deepStrictEqual(docker.selectDeployTagsToRemove(onDisk, 3, null), ['orbitron-x:d2']);
    // 빈 배열(버그로 비어 있는 keep-list) → 전량 삭제가 아니라 위치 규칙 폴백
    assert.deepStrictEqual(docker.selectDeployTagsToRemove(onDisk, 3, []), ['orbitron-x:d2']);
});

// ── 4. Keep-list assembly ────────────────────────────────────────────────────

test('buildKeepTagList: 성공 배포 행 + 현재 태그, 중복 제거', () => {
    const rows = [
        { image_tag: 'orbitron-x:d3' },  // 롤백 행 (d10) 이 가리키는 OLD 태그
        { image_tag: 'orbitron-x:d9' },
        { image_tag: 'orbitron-x:d7' },
    ];
    assert.deepStrictEqual(
        buildKeepTagList(rows, 'orbitron-x:d3'),
        ['orbitron-x:d3', 'orbitron-x:d9', 'orbitron-x:d7']
    );
});

test('buildKeepTagList: null 행/NULL image_tag 무시, currentTag 는 항상 포함', () => {
    assert.deepStrictEqual(buildKeepTagList([{ image_tag: null }, null], 'orbitron-x:d5'), ['orbitron-x:d5']);
    assert.deepStrictEqual(buildKeepTagList(null, 'orbitron-x:d5'), ['orbitron-x:d5']);
    assert.deepStrictEqual(buildKeepTagList([], null), []);
});
