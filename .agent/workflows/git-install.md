---
description: Linux 시스템에 Git을 설치하는 방법
---

# Git 설치 워크플로우

## 1. 현재 Git 설치 여부 확인

```bash
git --version
```

Git이 이미 설치되어 있으면 버전이 출력됩니다. 설치되어 있지 않으면 아래 단계를 진행합니다.

## 2. 패키지 목록 업데이트

// turbo
```bash
sudo apt-get update
```

## 3. Git 설치

```bash
sudo apt-get install -y git
```

## 4. 설치 확인

// turbo
```bash
git --version
```

## 5. Git 기본 설정 (최초 설치 시)

사용자 이름과 이메일을 설정합니다:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## 6. 설정 확인

// turbo
```bash
git config --list
```
