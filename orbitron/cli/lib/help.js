'use strict';

// 도움말 텍스트 — 한국어 우선, 영어 병기.

const GENERAL = `Orbitron CLI — 셀프호스팅 PaaS 명령줄 도구 / self-hosted PaaS command line

사용법 / Usage: orbitron <command> [options]

명령 / Commands:
  login [--server URL]         로그인 후 토큰 저장 / Log in and store a token
  logout                       토큰 폐기 및 로그아웃 / Revoke token and log out
  status                       프로젝트 목록·상태 / List projects and status
  deploy [--project <이름>]    배포 실행 후 완료까지 추적 / Deploy and watch until done
  logs <project> [--tail N]    컨테이너 로그 출력 (기본 200줄) / Print container logs
       [--grep <text>]         로그 검색 (부분 문자열) / Filter log lines by substring
  rollback <project>           이전 성공 배포로 롤백 / Roll back to a past deployment
  previews <project>           PR 프리뷰 목록 / List PR previews
  previews rm <project> <pr>   PR 프리뷰 삭제 / Delete a PR preview
  cron <project>               예약 작업 목록 / List cron jobs
  cron run <project> <name>    예약 작업 즉시 실행 / Run a cron job now
  help [command]               도움말 / Show help

종료 코드 / Exit codes: 0 성공 · 1 API/네트워크 오류 · 2 사용법 오류 · 3 인증 오류
설정 파일 / Config: ~/.orbitronrc (chmod 600)`;

const TOPICS = {
    login: `orbitron login [--server URL]

이메일/비밀번호로 로그인하고 토큰을 ~/.orbitronrc 에 저장합니다 (chmod 600).
서버가 PAT 를 지원하면 장기 토큰을 발급받고, 아니면 JWT(7일)를 저장합니다.
Log in with email/password; stores a PAT (long-lived) or JWT (7 days).

  --server URL   Orbitron 서버 주소 (기본: 저장된 값 또는 https://orbitron.twinverse.org)`,
    logout: `orbitron logout

저장된 PAT 를 서버에서 폐기하고 ~/.orbitronrc 를 삭제합니다.
Revokes the stored PAT on the server and deletes ~/.orbitronrc.`,
    status: `orbitron status

내 프로젝트 목록을 표로 출력합니다 (이름·서브도메인·상태·타입).
Prints your projects as a table (name, subdomain, status, type).`,
    deploy: `orbitron deploy [--project <name|subdomain>]

배포를 시작하고 완료(success/failed)까지 3초 간격으로 상태를 출력합니다 (최대 15분).
--project 생략 시 현재 git 저장소의 origin 주소로 프로젝트를 찾습니다.
Triggers a deploy and polls status every 3s until success/failed (15 min timeout).
Without --project, matches the current git repo's origin URL.`,
    logs: `orbitron logs <project> [--tail N] [--grep <text>]

컨테이너 로그 마지막 N줄을 출력합니다 (기본 200). 실시간 팔로우(-f)는 v1 미지원.
--grep 은 서버 측에서 부분 문자열(대소문자 무시)로 줄을 걸러 '줄번호: 내용'
형식으로 출력합니다 (정규식 아님, 최대 500건).
Prints the last N container log lines (default 200). No follow mode in v1.
--grep filters lines server-side by case-insensitive substring (not a regex,
max 500 matches), printed as 'line: text'.`,
    rollback: `orbitron rollback <project>

최근 성공 배포 목록에서 번호를 골라 해당 이미지로 롤백하고 완료까지 추적합니다.
Pick a past successful deployment by number and roll back to its image.`,
    previews: `orbitron previews <project>
orbitron previews rm <project> <pr>

PR 프리뷰 배포를 조회하거나 삭제합니다. / List or delete PR preview deployments.`,
    cron: `orbitron cron <project>
orbitron cron run <project> <name>

프로젝트의 예약 작업(cron)을 조회하거나 이름으로 즉시 실행합니다.
실행 결과(상태/출력)를 그대로 출력하며, 실패 시 종료 코드 1 입니다.
List a project's cron jobs, or trigger one by name and print its output
(exit code 1 if the run failed).`,
};

function helpText(topic) {
    if (topic && TOPICS[topic]) return TOPICS[topic];
    return GENERAL;
}

module.exports = { helpText, GENERAL, TOPICS };
