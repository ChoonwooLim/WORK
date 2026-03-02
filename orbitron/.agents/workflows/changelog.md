---
description: Orbitron 변경사항 발생 시 changelog.html 자동 업데이트
---

# Changelog 자동 업데이트 워크플로우

## 트리거 조건
Orbitron 프로젝트에 아래 작업을 수행한 경우 **반드시** changelog을 업데이트한다:
- 신규 기능 추가 (feature)
- 버그 수정 (fix)
- 기존 기능 개선 (improve)
- 보안 패치 (security)
- 문서 업데이트 (docs) — 대규모인 경우만

## 업데이트 방법

### 1. 기존 최신 버전에 항목 추가
같은 날짜의 버전 블록이 이미 있으면, 해당 블록의 `<ul class="change-list">` 안에 새 항목을 추가한다:

```html
<li class="change-item">
    <span class="change-badge badge-{type}">뱃지텍스트</span>
    <div class="change-content">
        <strong>제목</strong>
        <p>설명</p>
    </div>
</li>
```

### 2. 새 버전 블록 생성
날짜가 다르거나 큰 마일스톤이면, 타임라인 최상단에 새 버전 블록을 추가한다:
- 버전 번호: 마이너 기능은 패치 증가 (v1.5.1), 큰 기능은 마이너 증가 (v1.6.0)
- `<div class="timeline-container">` 바로 아래에 새 `<div class="version-block">` 삽입

### 3. 뱃지 타입
| 타입 | CSS 클래스 | 한글 텍스트 |
|------|-----------|------------|
| 신기능 | `badge-feature` | 신기능 |
| 버그수정 | `badge-fix` | 버그수정 |
| 개선 | `badge-improve` | 개선 |
| 문서 | `badge-docs` | 문서 |
| 보안 | `badge-security` | 보안 |

### 4. 파일 위치
- `public/changelog.html` — 메인 changelog 페이지

## 중요
- 이 워크플로우는 Orbitron 작업 완료 후 **자동으로** 실행한다
- 사용자가 별도로 요청하지 않아도 변경사항이 있으면 반드시 업데이트한다
- 이슈보드(`/api/issues`)에도 동시에 이슈를 등록한다
