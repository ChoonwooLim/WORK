# 🎬 AI 영상 생성 (Wan 2.2)

> ✨ **2026.04 v2.2 신규**: Orbitron은 이제 **Alibaba의 오픈소스 Wan 2.2 비디오 모델**을 내장 GPU 서버에서 호스팅하여 프롬프트나 이미지를 MP4 영상으로 즉시 변환합니다.

배포 플랫폼 안에서 **AI 영상 생성까지** 할 수 있게 되었습니다. 별도 서비스 가입, API 키, 토큰당 과금 없이, 여러분의 GPU로 직접 영상을 생성하고 Orbitron 대시보드 안에서 바로 재생합니다.

---

## 🚀 빠른 시작

1. 대시보드 왼쪽 사이드바 → **AI 스튜디오 → 🎬 AI 영상 생성 (Wan 2.2)** 클릭
2. 탭 선택:
   - **Text → Video** — 프롬프트 텍스트만으로 영상 생성
   - **Image → Video** — 정지 이미지를 업로드해 애니메이션 생성
3. 프롬프트 입력, 모델 선택, 프레임 수/단계/해상도 설정
4. **🎬 영상 생성** 버튼 → 완료되면 우측 플레이어에 바로 재생

예시 프롬프트:
- `"a red panda walking through a snowy forest at dusk, cinematic shallow depth of field"`
- `"silver Porsche 911 racing through Tokyo rain at night, neon reflections"`
- `"aurora over a snowy mountain range, drone aerial shot"`

---

## 🎯 3가지 모델 비교

Orbitron에 통합된 Wan 2.2 모델은 3가지이며 각자 다른 용도에 최적화되어 있습니다.

| 모델 | 크기 | VRAM | 속도 | 품질 | 추천 사용처 |
|------|------|------|------|------|-------------|
| **⚡ ti2v-5b** | 5B params / 32GB | ~11GB | 🏎 빠름 (~36s/클립) | ★★★ | 실험, 반복 프로토타이핑, 아이디어 스케치 |
| **🏆 t2v-14b** | A14B MoE / 118GB | ~24GB | 🐢 느림 (~3-5분/클립) | ★★★★★ | 최종 결과물, 시네마틱 품질, 720p |
| **🎯 i2v-14b** | A14B MoE / 118GB | ~24GB | 🐢 느림 (~3-5분/클립) | ★★★★★ | 정지 이미지를 애니메이션으로 변환 |

> 💡 **첫 시도는 `ti2v-5b`로 빠르게 반복**한 뒤, 마음에 드는 프롬프트/씬을 `t2v-14b`로 최종 렌더하는 워크플로우를 추천합니다.

---

## 📋 파라미터 설명

| 필드 | 의미 | 권장값 |
|------|------|--------|
| **Prompt** | 생성할 영상의 텍스트 묘사 | 한 문장의 구체적 설명 + 시각 스타일 키워드 |
| **Negative prompt** | 피하고 싶은 특성 | `blurry, watermark, deformed, text` 등 |
| **Frames** | 영상의 프레임 수 | 17~49 (fps와 함께 영상 길이 결정) |
| **Steps** | 확산 단계 (높을수록 품질 ↑ 시간 ↑) | ti2v: 20~30, A14B: 8~20 |
| **FPS** | 초당 프레임 수 | 12~24 (12는 영화적, 24는 부드러움) |
| **Width/Height** | 해상도 | 480×832 (세로 영상용 832×480 권장) |
| **Seed** | 랜덤 시드 (빈 값 = 매번 다른 결과) | 동일 시드로 재현 가능 |

**영상 길이 공식**: `Frames ÷ FPS = 초`
- 예: 33프레임 ÷ 16fps ≈ 2초 클립

---

## 🏗 아키텍처 — 분산 GPU 라우팅

Orbitron은 **프로덕션 대시보드 호스트와 무거운 AI 추론을 담당하는 전용 GPU 서버를 분리**하여 운영합니다:

```
  ┌────────────────────────────────────┐        ┌─────────────────────────────┐
  │   Orbitron 대시보드 호스트          │   LAN   │   twinverse-ai GPU 서버     │
  │   (Dual GTX 1080, 16GB)            │◄──────►│   (Threadripper 3970X,      │
  │                                    │        │    RTX 3090 24GB, 128GB RAM)│
  │  ┌──────────────┐                  │        │  ┌────────────────────────┐ │
  │  │ Orbitron     │                  │        │  │ Ollama (Gemma 4 등)    │ │
  │  │ (PM2, :4000) │─┐                │        │  │  :11434               │ │
  │  └──────────────┘ │                │        │  ├────────────────────────┤ │
  │                   │  /api/wan/*    │        │  │ wan-video-service      │ │
  │                   └───────────────►│        │  │  (FastAPI, :8200)      │ │
  │                                    │        │  │   • Wan 2.2 TI2V-5B    │ │
  │  services/wanVideo.js              │        │  │   • Wan 2.2 T2V-A14B   │ │
  │  routes/wan.js (프록시)            │        │  │   • Wan 2.2 I2V-A14B   │ │
  │                                    │        │  ├────────────────────────┤ │
  │                                    │        │  │ ai-image-service       │ │
  │                                    │        │  │  (SodamFN Flux, :8100) │ │
  │                                    │        │  └────────────────────────┘ │
  └────────────────────────────────────┘        └─────────────────────────────┘
```

**이렇게 분리한 이유**:
- **성능**: RTX 3090 24GB는 GTX 1080 8GB보다 더 큰 모델(31B LLM, A14B MoE 비디오)을 올릴 수 있음
- **보안**: GPU 서버는 LAN 내부에만 노출 (UFW로 192.168.219.0/24만 허용). 외부 인터넷에서 직접 접근 불가
- **격리**: 대시보드 호스트의 Orbitron 재시작이 진행 중인 영상 생성에 영향을 주지 않음
- **확장성**: 나중에 GPU 서버를 2대, 3대로 늘려도 `OLLAMA_HOST`/`WAN_VIDEO_HOST` 환경변수만 바꾸면 됨

**Orbitron 환경변수** (`.env`):
```bash
OLLAMA_HOST=http://192.168.219.117:11434       # Gemma 4 원격 GPU 서버
WAN_VIDEO_HOST=http://192.168.219.117:8200     # Wan 2.2 원격 GPU 서버 (기본값)
```

---

## 🔐 프록시 구조 — LAN IP 유출 방지

브라우저가 직접 GPU 서버(`192.168.219.117:8200`)에 접속하면 내부 IP가 클라이언트로 노출됩니다. 그래서 Orbitron은 **모든 요청을 서버사이드 프록시**합니다:

| 클라이언트가 보는 URL | 실제 Orbitron이 포워딩하는 곳 |
|---|---|
| `POST /api/wan/t2v` | `POST http://192.168.219.117:8200/t2v` |
| `POST /api/wan/i2v` | `POST http://192.168.219.117:8200/i2v` |
| `GET  /api/wan/video/<filename>` | `GET http://192.168.219.117:8200/video/<filename>` (스트리밍) |
| `GET  /api/wan/status` | `GET http://192.168.219.117:8200/` |

**이득**:
- 외부 네트워크로 GPU 서버의 내부 IP가 새어나가지 않음
- Orbitron의 `authMiddleware + viewerGuard` 인증을 거치므로 비로그인 유저는 접근 불가
- 추후 GPU 서버 주소가 바뀌어도 클라이언트 코드는 수정 불필요

---

## ⚡ GPU VRAM 동적 공유

**한 대의 RTX 3090 24GB**를 **Ollama(Gemma 4) + Wan 비디오 + ai-image-service**가 공유합니다. 동시 실행 시 OOM이 나지 않도록 다음 3중 안전망이 가동됩니다:

1. **Ollama `OLLAMA_KEEP_ALIVE=30s`** — 마지막 채팅 요청 후 30초 idle이면 자동으로 Gemma 모델을 VRAM에서 내립니다. 즉 **Gemma는 사용 중일 때만 VRAM을 점유**합니다.
2. **Wan 서비스의 `_free_ollama_vram()`** — A14B 모델 로드 직전에 Ollama에 `keep_alive:0`을 요청하여 **즉시** VRAM을 비웁니다. 비디오 생성은 Gemma를 기다리지 않습니다.
3. **diffusers `enable_sequential_cpu_offload()`** — A14B MoE(28GB bfloat16)를 24GB VRAM에 맞추기 위해 레이어 단위로 CPU↔GPU 스트리밍. 약간 느리지만 OOM 없음.

---

## 🛠 내부 구현 세부사항 (고급)

### FastAPI 서비스 (`/srv/wan-video-service/wan_service.py` on twinverse-ai)

- 파이프라인은 **지연 로드(lazy-load)** — 첫 요청 때만 모델을 메모리에 올림
- **한 번에 하나의 파이프라인만 VRAM 보유** — 새 모델을 올리기 전에 이전 것을 명시적으로 evict + `torch.cuda.empty_cache()`
- `ti2v-5b`: 전체 VRAM 로드 (`pipe.to("cuda")`), 속도 우선
- `t2v-14b` / `i2v-14b`: `enable_sequential_cpu_offload()` + `enable_vae_tiling()` + `enable_vae_slicing()`, 메모리 최적 우선
- 모델 데이터는 HuggingFace `-Diffusers` 접미사 레포 사용 (원본 Wan 레포는 flat checkpoint 포맷이라 diffusers가 직접 못 읽음)

### systemd 서비스
```bash
# GPU 서버에서 상태 확인
ssh stevenlim@192.168.219.117 'sudo journalctl -u wan-video-service -f'
ssh stevenlim@192.168.219.117 'systemctl is-active wan-video-service'
```

### 환경 변수 (systemd drop-in at `/etc/systemd/system/wan-video-service.service.d/override.conf`)
```ini
[Service]
Environment="PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True"
```
GPU VRAM 단편화 완화로 A14B 모델이 더 안정적으로 로드됩니다.

---

## 📈 성능 벤치마크 (RTX 3090 24GB, 실측)

| 작업 | 콜드 로드 | 생성 시간 | 총 |
|------|----------|-----------|-----|
| ti2v-5b / 17프레임 / 20 steps | 21s | 36s | 57s |
| ti2v-5b / 17프레임 / 10 steps | (warm) | ~18s | 18s |
| t2v-14b / 17프레임 / 8 steps | ~50s | 200s | 250s |
| t2v-14b / 33프레임 / 20 steps | (warm) | ~4-5분 예상 | ~4-5분 |
| i2v-14b / 17프레임 / 8 steps | ~50s | 188s | 238s |

> ⚡ **팁**: 같은 모델로 연속 생성 시 파이프라인이 warm 상태로 유지되어 훨씬 빠릅니다. 모델을 바꾸면 evict + 재로드 비용이 발생합니다.

---

## ❓ 자주 묻는 질문

**Q1. 영상 생성에 실패하고 `500 OOM` 이 뜹니다.**
- 프레임 수(Frames)를 낮추세요 (17로 시도)
- 해상도를 낮추세요 (832×480 권장)
- Inference steps를 낮추세요 (8~10)
- 모델을 `ti2v-5b`로 바꿔보세요

**Q2. `ti2v-5b` 대비 `t2v-14b`의 품질 차이가 많이 나나요?**
- 네. A14B MoE는 시네마틱 조명, 복잡한 모션, 텍스처 디테일에서 명확히 우월합니다
- 하지만 5배 느리므로, **프롬프트 초안은 ti2v로, 최종은 t2v-14b로** 하는 파이프라인을 권장

**Q3. 영상이 너무 짧아요 (2-3초). 더 긴 영상은?**
- Wan 2.2 공식 모델은 최대 121 프레임까지 지원
- 그 이상은 여러 클립을 생성해서 후처리(FFmpeg)로 이어 붙여야 함
- 긴 영상(예: 10초 이상)은 GPU 메모리 제약으로 여러 번 나눠 생성 후 스티칭 권장

**Q4. Wan 2.5는 안 되나요?**
- 2026년 4월 현재, **Wan 2.5는 Alibaba API 전용**이고 공식 오픈소스 가중치가 공개되지 않았습니다
- HuggingFace에 있는 `wan25-*`는 커뮤니티 미공인 변환본이라 안정성/호환성 보장 안 됨
- Orbitron은 **공식 최신 OSS인 Wan 2.2**를 채택. 공식 2.5가 공개되면 즉시 추가 예정

**Q5. 다른 모델(HunyuanVideo, LTX-Video 등)도 추가할 수 있나요?**
- 네. `services/wan-video-service/wan_service.py`의 `REPOS` 테이블에 매핑만 추가하면 됩니다
- 다만 HunyuanVideo는 45-80GB VRAM이 필요해서 RTX 3090 단일 카드에는 부적합
- LTX-Video (2B, 12GB VRAM)은 즉시 추가 가능 — 필요 시 알려주세요

**Q6. 생성한 영상은 어디에 저장되나요?**
- GPU 서버의 `/srv/wan-video-service/outputs/` 디렉토리에 MP4 파일로 영구 보존
- Orbitron 대시보드에서는 `/api/wan/video/<filename>` 으로 스트리밍 재생
- 다운로드하려면 비디오 플레이어의 컨텍스트 메뉴에서 "비디오 저장"

---

## 🛡 보안

- GPU 서버는 **LAN 전용**: UFW가 192.168.219.0/24 외부를 막음
- Orbitron `/api/wan/*` 경로는 **모두 인증 필요** (로그인하지 않으면 401)
- SSH는 **키 인증만** (비밀번호 로그인 비활성)
- Wan 서비스 자체는 외부 인증 없음 (신뢰된 LAN 전제). 외부 노출 시 추가 인증 계층 필요

---

## 🗺 로드맵

| 기능 | 상태 |
|------|------|
| 3개 Wan 2.2 모델 (TI2V/T2V/I2V) | ✅ 완료 |
| 대시보드 UI + 플레이어 | ✅ 완료 |
| LAN 프록시 + 인증 | ✅ 완료 |
| 생성 결과 프로젝트별 갤러리 | 📋 예정 |
| 프롬프트 히스토리/즐겨찾기 | 📋 예정 |
| 공식 Wan 2.5 지원 | 📋 Alibaba 오픈소스 공개 시 즉시 |
| FP8 양자화로 A14B 속도 2-3× | 🔬 실험 중 |
| LCM/Turbo LoRA로 step 수 1/4 | 🔬 실험 중 |
| 여러 GPU 서버 로드 밸런싱 | 📋 예정 |
