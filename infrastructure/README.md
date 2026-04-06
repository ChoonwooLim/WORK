# Orbitron Infrastructure

Orbitron 서버 인프라 설정 리포지토리.

## 구조

```
infrastructure/
├── nginx/              # nginx 리버스 프록시 설정
│   ├── nginx.conf
│   └── conf.d/         # 서비스별 설정
├── deskrpg/            # DeskRPG 가상 오피스
│   ├── proxy.js        # HTTP/WebSocket 프록시 (3100→3102+3103)
│   ├── start.sh        # 시작 스크립트
│   ├── stop.sh         # 중지 스크립트
│   └── migrate.sql     # 추가 DB 마이그레이션
├── cloudflared/        # Cloudflare Tunnel 설정
│   └── config.yml
└── docker-compose.yml  # PostgreSQL, pgAdmin, nginx
```

## DeskRPG 실행

```bash
bash deskrpg/start.sh   # 시작
bash deskrpg/stop.sh    # 중지
```

## 서비스 포트

| 서비스 | 포트 | 설명 |
|--------|------|------|
| DeskRPG Proxy | 3100 | Cloudflare Tunnel 진입점 |
| DeskRPG HTTP | 3102 | Next.js 서버 |
| DeskRPG WS | 3103 | Socket.IO 서버 |
| PostgreSQL | 3718 | Orbitron DB |
| nginx | 80/443 | 리버스 프록시 |
