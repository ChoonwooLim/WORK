# 🎬 AI Video Generation (Wan 2.2)

> ✨ **New in 2026.04 v2.2**: Orbitron now hosts **Alibaba's open-source Wan 2.2 video models** on a dedicated GPU server, turning prompts and still images into MP4 videos right inside your deployment dashboard.

**AI video generation is now built into Orbitron**. No signup with third-party services, no API keys, no per-token billing — you run the models on your own GPU and get the MP4 back straight in the dashboard.

---

## 🚀 Quick Start

1. Dashboard sidebar → **AI Studio → 🎬 AI Video Generation (Wan 2.2)**
2. Choose a tab:
   - **Text → Video** — generate from a prompt alone
   - **Image → Video** — upload a still and animate it
3. Type a prompt, pick a model, set frames / steps / resolution
4. Click **🎬 Generate** → the MP4 plays in the right-side player when done.

Example prompts:
- `"a red panda walking through a snowy forest at dusk, cinematic shallow depth of field"`
- `"silver Porsche 911 racing through Tokyo rain at night, neon reflections"`
- `"aurora over a snowy mountain range, drone aerial shot"`

---

## 🎯 Three Models at a Glance

| Model | Size | VRAM | Speed | Quality | Recommended use |
|-------|------|------|-------|---------|-----------------|
| **⚡ ti2v-5b** | 5B / 32GB | ~11GB | 🏎 fast (~36s / clip) | ★★★ | Experiments, prompt iteration, idea sketches |
| **🏆 t2v-14b** | A14B MoE / 118GB | ~24GB | 🐢 slow (~3-5min / clip) | ★★★★★ | Final renders, cinematic quality, 720p |
| **🎯 i2v-14b** | A14B MoE / 118GB | ~24GB | 🐢 slow (~3-5min / clip) | ★★★★★ | Still-image → video animation |

> 💡 **Typical workflow**: iterate prompts fast with `ti2v-5b`, then do a final render with `t2v-14b` once you're happy with the concept.

---

## 📋 Parameter Reference

| Field | Meaning | Suggested |
|-------|---------|-----------|
| **Prompt** | Text description of the video | One concrete sentence + style keywords |
| **Negative prompt** | Traits to avoid | `blurry, watermark, deformed, text` |
| **Frames** | Number of frames in the video | 17–49 (with fps → clip length) |
| **Steps** | Diffusion steps (higher = better, slower) | ti2v: 20–30, A14B: 8–20 |
| **FPS** | Frames per second | 12–24 (12 = cinematic, 24 = smooth) |
| **Width/Height** | Resolution | 480×832 (portrait), 832×480 (landscape) |
| **Seed** | Random seed (blank = random each run) | Fixed seed = reproducible output |

**Clip length**: `Frames ÷ FPS = seconds` — e.g. 33 frames ÷ 16fps ≈ 2 s.

---

## 🏗 Architecture — Distributed GPU Routing

Orbitron splits the **production dashboard host** from the **dedicated AI-inference GPU server**:

```
  ┌────────────────────────────────────┐        ┌─────────────────────────────┐
  │   Orbitron Dashboard Host          │   LAN  │   twinverse-ai GPU Server   │
  │   (Dual GTX 1080, 16GB)            │◄──────►│   (Threadripper 3970X,      │
  │                                    │        │    RTX 3090 24GB, 128GB RAM)│
  │  ┌──────────────┐                  │        │  ┌────────────────────────┐ │
  │  │ Orbitron     │                  │        │  │ Ollama (Gemma 4, ...)  │ │
  │  │ (PM2, :4000) │─┐                │        │  │  :11434               │ │
  │  └──────────────┘ │                │        │  ├────────────────────────┤ │
  │                   │  /api/wan/*    │        │  │ wan-video-service      │ │
  │                   └───────────────►│        │  │  (FastAPI, :8200)      │ │
  │                                    │        │  │   • Wan 2.2 TI2V-5B    │ │
  │                                    │        │  │   • Wan 2.2 T2V-A14B   │ │
  │                                    │        │  │   • Wan 2.2 I2V-A14B   │ │
  │  services/wanVideo.js (client)     │        │  ├────────────────────────┤ │
  │  routes/wan.js      (proxy)        │        │  │ ai-image-service       │ │
  │                                    │        │  │  (Flux, :8100)         │ │
  │                                    │        │  └────────────────────────┘ │
  └────────────────────────────────────┘        └─────────────────────────────┘
```

**Why split the two hosts**:
- **Performance**: RTX 3090 24GB holds larger models (31B LLMs, A14B MoE video) than dual GTX 1080 can
- **Security**: GPU server is LAN-only (UFW allowlists 192.168.219.0/24). Not reachable from the internet
- **Isolation**: Restarting Orbitron does not kill an ongoing video render
- **Scalability**: Add more GPU hosts later by simply changing `OLLAMA_HOST` / `WAN_VIDEO_HOST` env vars

Orbitron env (`.env`):
```bash
OLLAMA_HOST=http://192.168.219.117:11434        # Gemma 4 remote GPU
WAN_VIDEO_HOST=http://192.168.219.117:8200      # Wan 2.2 remote GPU (default)
```

---

## 🔐 Proxy Layer — No LAN IP Leakage

If the browser hit `192.168.219.117:8200` directly, your internal network IP would be exposed to every visitor. Instead Orbitron **proxies everything server-side**:

| URL the client sees | Where Orbitron actually forwards |
|---|---|
| `POST /api/wan/t2v` | `POST http://192.168.219.117:8200/t2v` |
| `POST /api/wan/i2v` | `POST http://192.168.219.117:8200/i2v` |
| `GET  /api/wan/video/<file>` | streams `GET http://192.168.219.117:8200/video/<file>` |
| `GET  /api/wan/status` | `GET http://192.168.219.117:8200/` |

Benefits: the internal IP never leaves the server, every request is gated by Orbitron's `authMiddleware + viewerGuard`, and you can relocate the GPU server without touching the browser code.

---

## ⚡ Dynamic GPU VRAM Sharing

A single RTX 3090 is shared by Ollama (Gemma 4), the Wan video pipelines, and the ai-image-service. Three guard rails keep everything from OOM-ing:

1. **`OLLAMA_KEEP_ALIVE=30s`** — Ollama unloads its model from VRAM 30 s after the last request, so Gemma only holds VRAM *while actively chatting*.
2. **`_free_ollama_vram()` inside the Wan service** — before loading an A14B pipeline, the service posts `keep_alive:0` to Ollama, forcing an immediate unload. Video generation never waits for Gemma to time out.
3. **`enable_sequential_cpu_offload()`** — the 28GB-bfloat16 A14B MoE doesn't fit in 24GB VRAM by itself; diffusers streams layers on/off the GPU one at a time. Slightly slower but never OOMs.

---

## 🛠 Implementation Details (advanced)

### FastAPI service (`/srv/wan-video-service/wan_service.py` on twinverse-ai)

- Pipelines are **lazy-loaded** — the first request for a model pays the full load cost.
- **At most one pipeline stays in VRAM** — loading a second one evicts the first (`del`, `torch.cuda.empty_cache()`).
- `ti2v-5b` is moved entirely to GPU (`pipe.to("cuda")`) for speed.
- `t2v-14b` / `i2v-14b` use `enable_sequential_cpu_offload()` + `enable_vae_tiling()` + `enable_vae_slicing()` for memory.
- Models come from the `-Diffusers` suffix HuggingFace repos (plain Wan repos ship a flat PyTorch checkpoint layout diffusers can't load directly).

### systemd management
```bash
# From the GPU server:
sudo journalctl -u wan-video-service -f
systemctl is-active wan-video-service
```

### systemd drop-in (`/etc/systemd/system/wan-video-service.service.d/override.conf`)
```ini
[Service]
Environment="PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True"
```
Reduces CUDA allocator fragmentation so A14B loads more reliably.

---

## 📈 Measured Performance (RTX 3090 24GB)

| Task | Cold load | Generation | Total |
|------|-----------|-----------|-------|
| ti2v-5b, 17 frames, 20 steps | 21 s | 36 s | 57 s |
| ti2v-5b, 17 frames, 10 steps | (warm) | ~18 s | 18 s |
| t2v-14b, 17 frames, 8 steps | ~50 s | 200 s | 250 s |
| t2v-14b, 33 frames, 20 steps | (warm) | ~4–5 min | ~4–5 min |
| i2v-14b, 17 frames, 8 steps | ~50 s | 188 s | 238 s |

> ⚡ **Tip**: consecutive calls to the same model reuse the warm pipeline. Switching models triggers a full evict + reload.

---

## ❓ FAQ

**Q1. I get a 500 OOM.**
- Lower frames (try 17)
- Lower resolution (832×480 or 480×832)
- Lower inference steps (8–10)
- Switch to `ti2v-5b`

**Q2. Is `t2v-14b` really better than `ti2v-5b`?**
- Yes — A14B MoE wins on cinematic lighting, complex motion, and texture detail. It's ~5× slower though, so iterate cheaply with `ti2v-5b` and reserve A14B for final renders.

**Q3. The clips are short (2–3 s). How do I get longer videos?**
- Official Wan 2.2 supports up to 121 frames. Beyond that, generate multiple clips and stitch with FFmpeg.

**Q4. What about Wan 2.5?**
- As of April 2026, **Wan 2.5 is API-only** (Alibaba's commercial service) — no official open-source weights.
- Community `wan25-*` repos on HuggingFace are unofficial conversions, not integrated here.
- Orbitron ships **Wan 2.2**, the current official SOTA OSS. We'll add 2.5 the moment weights are released.

**Q5. Can I add other open-source video models (HunyuanVideo, LTX-Video)?**
- Yes — just extend the `REPOS` table in `wan_service.py`. LTX-Video (2B, 12GB VRAM) drops in cleanly; HunyuanVideo needs 45–80GB VRAM, so it doesn't fit on a single RTX 3090 without multi-GPU or FP8 quantization.

**Q6. Where are the generated videos stored?**
- On the GPU server at `/srv/wan-video-service/outputs/`.
- In the dashboard they stream via `/api/wan/video/<filename>`.
- Right-click the player → *Save video as* to download.

---

## 🛡 Security

- GPU server is **LAN-only**: UFW blocks everything outside `192.168.219.0/24`.
- Every `/api/wan/*` endpoint is **authenticated** — logged-out users get 401.
- SSH is **key-only** (password auth disabled).
- The raw Wan service itself has no auth (LAN-trusted); add one if you expose it beyond the LAN.

---

## 🗺 Roadmap

| Feature | Status |
|---------|--------|
| Three Wan 2.2 models (TI2V/T2V/I2V) | ✅ Done |
| Dashboard UI + player | ✅ Done |
| LAN proxy + auth | ✅ Done |
| Per-project video gallery | 📋 Planned |
| Prompt history / favorites | 📋 Planned |
| Official Wan 2.5 support | 📋 As soon as Alibaba open-sources it |
| FP8 quantization → 2-3× faster A14B | 🔬 In exploration |
| LCM / Turbo LoRA → 1/4 steps | 🔬 In exploration |
| Multi-GPU-server load balancing | 📋 Planned |
