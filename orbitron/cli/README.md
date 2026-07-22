# Orbitron CLI

Orbitron 셀프호스팅 PaaS 를 터미널에서 조작하는 명령줄 도구입니다.
대시보드와 **동일한 REST API** 를 호출하며, 런타임 의존성이 **0개**입니다 (Node ≥ 18 내장 모듈만 사용).

A zero-dependency command-line interface for the Orbitron self-hosted PaaS.
Talks to the same REST API the dashboard uses. Requires Node.js 18+.

## 설치 / Install

```bash
# 저장소에서 전역 설치 / global install from the repo
cd orbitron/cli
npm install -g .

# 또는 설치 없이 바로 실행 / or run directly
node orbitron/cli/bin/orbitron.js --help
```

## 빠른 시작 / Quickstart

```bash
orbitron login --server https://orbitron.twinverse.org   # 이메일/비밀번호 로그인
orbitron status                                          # 프로젝트 목록
orbitron deploy --project myapp                          # 배포 + 완료까지 추적
orbitron logs myapp --tail 100                           # 컨테이너 로그
```

`deploy` 는 `--project` 를 생략하면 현재 git 저장소의 `origin` 주소를
프로젝트의 GitHub URL 과 대조해 자동으로 찾습니다.

## 명령 / Commands

| 명령 | 설명 |
|---|---|
| `orbitron login [--server URL]` | 이메일/비밀번호 로그인. 서버가 지원하면 장기 PAT 발급, 아니면 JWT(7일) 저장 |
| `orbitron logout` | 저장된 PAT 를 서버에서 폐기하고 설정 파일 삭제 |
| `orbitron status` | 프로젝트 표 (이름 · 서브도메인 · 상태 · 타입) |
| `orbitron deploy [--project <name\|subdomain>]` | 배포 시작 후 3초 간격 폴링, success/failed 까지 (최대 15분) |
| `orbitron logs <project> [--tail N]` | 컨테이너 로그 마지막 N줄 (기본 200) |
| `orbitron rollback <project>` | 최근 성공 배포 목록에서 번호 선택 → 확인 → 롤백 + 추적 |
| `orbitron previews <project>` | PR 프리뷰 배포 목록 |
| `orbitron previews rm <project> <pr>` | PR 프리뷰 삭제 |
| `orbitron help [command]` | 도움말 |

프로젝트 이름 해석 우선순위: **정확한 subdomain > 정확한 name > git remote 매칭**.

## 종료 코드 / Exit codes

| 코드 | 의미 |
|---|---|
| 0 | 성공 / success |
| 1 | API·네트워크 오류 / API or network error |
| 2 | 사용법 오류 / usage error |
| 3 | 인증 오류 — `orbitron login` 으로 재로그인 / auth error |

## 설정 파일 / Config

- 위치: `~/.orbitronrc` (JSON, 항상 `chmod 600`)
- 내용: `{ "server": "...", "token": "...", "tokenType": "pat|jwt", "patId": n }`
- `ORBITRON_CONFIG` 환경변수로 경로를 바꿀 수 있습니다 (주로 테스트용).
- 색상 출력은 [`NO_COLOR`](https://no-color.org) 환경변수를 존중하며, TTY 가 아니면 자동으로 꺼집니다.

## 참고 / Notes

- 로그 실시간 팔로우(`-f`)는 v1 미지원 — 서버에 컨테이너 로그 SSE 엔드포인트가 아직 없습니다.
- PAT(개인 액세스 토큰)는 `POST /api/auth/tokens` 로 발급되고 서버에는 SHA-256 해시만 저장됩니다.
  구버전 서버(PAT 미지원)에서는 자동으로 JWT 저장으로 폴백합니다 (7일 후 재로그인 필요).
