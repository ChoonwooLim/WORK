# Genius AI Assistant (Error Troubleshooting)

Have you ever panicked during a deployment when your terminal was filled with an endless stream of angry red error logs on a black screen?

> `ModuleNotFoundError: No module named 'django.core.wsgi'`
> `Error: listen EADDRINUSE: address already in use :::3000`

When facing such nightmare errors, you normally waste dozens of minutes scouring Google or Stack Overflow. But behind the Orbitron system, **ultra-precise AI engineers** are on standby to instantly decipher your error codes in just 1 second.

> 🌟 **Triple LLM Routing (New in 2026.04)**: Orbitron now supports three AI engines — **Anthropic Claude · Google Gemini · Local Google Gemma 4**. Cloud models (Claude/Gemini) provide maximum reasoning power, while the local model (Gemma 4) gives you zero-cost, fully-offline inference with full data privacy. Choose freely on a per-project basis.

---

## 🔑 How to Setup the AI Assistant

To use this feature, you must manually plug in the API Key for cloud models. Do this just once and you have a dedicated coding secretary for life. (However, if you pick the **Local Gemma 4** option below, no API key is needed at all.)

1.  Enter the **`Settings`** menu by clicking the gear icon in the top right corner of the dashboard.
2.  Click the **`LLM Settings`** tab. You will see the available AI models:
    - 👑 **Claude 4.6 Opus / Sonnet** (Anthropic Tier-1 coding specialist)
    - 🔭 **Gemini 3.1 Pro / Flash, Gemini 2.5 Pro / Flash** (Google's strongest reasoning)
    - 🌱 **Gemma 4 E4B** (Local · Free, Ollama) — no API key required
3.  For Claude or Gemini, go to the company's website, sign up, get your `API Key`, paste it into the blank field, and Save. **For Gemma 4 E4B, the key field is hidden** and a green info banner appears — it works immediately.
4.  Now, the AI Brain Activation Switch at the bottom of the system dashboard will turn green (ON).

---

## 🌱 Local Gemma 4 (Ollama-based) — New in 2026.04

> 💡 **Zero cost · Fully offline · Data privacy**: Run the Google Gemma 4 model directly on your Orbitron server, processing all AI inference without ever calling an external API.

### What's different?

| Aspect | Claude / Gemini (Cloud) | 🌱 Gemma 4 E4B (Local) |
|---|---|---|
| API key required | ✅ Yes | ❌ No |
| Cost | Per-token billing | Free |
| Internet | Required | Not required |
| Data transmission | Sent to external cloud | Never leaves the server |
| Inference speed | 1-3s (network dependent) | ~46 tokens/s (local GPU) |
| Model size | (managed) | 9.6GB (Q4_K_M, 8B params) |
| GPU requirement | None | NVIDIA CUDA or Apple Silicon |

### How to use

1. Project settings → **🤖 AI Error Analysis Model** → select **`🌱 Gemma 4 E4B (Local · Free, Ollama)`**
2. Save — instantly active without any key entry
3. From now on, all AI features for that project run locally:
   - Automatic error analysis on deployment failure
   - **`💬 Request AI Analysis`** chat (full action-tag support including `[ACTION:FIX_AND_DEPLOY]`)
   - Automatic code patch generation (`aiAutoRepair.analyzeAndGeneratePatch`)

### When is local Gemma 4 the better choice?

- **Confidential projects**: When you can't risk sensitive corporate code or env vars being sent to external LLM providers
- **Onboarding without API keys**: When new users want to try AI debugging without first signing up with Anthropic / Google
- **Cost reduction**: For learning/experimental projects with frequent build failures, drive token costs to zero
- **Unstable internet**: For air-gapped or field environments where external API responses may be slow or fail

### When are cloud models better?

- **Complex multi-file refactoring**: When you need Claude 4.6 Opus / Gemini 3.1 Pro's 200K+ context window and stronger reasoning
- **Rare libraries / brand-new framework errors**: When the cloud models may have more recent training data

> ⚙️ **Advanced (server admins)**: Orbitron uses the Ollama endpoint at `http://127.0.0.1:11434` by default. To run the GPU server on a different machine, just add `OLLAMA_HOST=http://X.X.X.X:11434` to PM2's environment. Model data is stored at the path defined by the `OLLAMA_MODELS` environment variable (e.g., a separate data drive) instead of the system disk, eliminating system partition pressure.

> 🚀 **Extending**: The default exposed model is `gemma-4-e4b` (8B, 9.6GB), but the routing table also has `gemma-4-e2b / gemma-4-26b / gemma-4-31b` registered. Pull a larger variant on the server (`ollama pull gemma4:31b` etc.) and adding the dropdown option is enough to use it.

---

## 🖥 Routing Gemma to a Remote GPU Server (New in 2026.04 v2.2)

Orbitron now supports **splitting the dashboard host from a dedicated AI-inference GPU box**. Run the lightweight dashboard on a low-power machine and offload the heavy AI to a Threadripper + RTX 3090 class server.

### How

Add one line to `.env`:

```bash
OLLAMA_HOST=http://192.168.219.117:11434
```

All Gemma calls automatically route to the remote server — no code changes. `services/aiAnalyzer.js` and `services/aiAutoRepair.js` read this env var to build their fetch URLs.

### Measured performance

| Environment | Inference speed | Warmup (cold start) |
|-------------|-----------------|---------------------|
| Local GTX 1080 ×2 (16GB split) | ~46 tokens/s | 43.5 s |
| Remote RTX 3090 24GB (dedicated) | **~133 tokens/s (2.9×)** | **5.2 s (8.4×)** |

### Additional benefits

- **Scalability**: point at any number of GPU hosts by flipping `OLLAMA_HOST`; load balancers drop in behind the same contract.
- **Isolation**: restarting Orbitron no longer interrupts an active AI inference.
- **GPU sharing**: when Gemma and the Wan video pipelines share a single RTX 3090, `OLLAMA_KEEP_ALIVE=30s` makes Gemma hold VRAM *only while active*. See the [AI Video Generation guide](/docs-en.html#/ai-video) for the full story.
- **Security**: the GPU server is LAN-only via UFW; clients reach it exclusively through Orbitron's authenticated proxy.

### Topologies

**Single host (default)**:
```
[Orbitron + Ollama on one box] → local GPU
.env: (OLLAMA_HOST unset → defaults to 127.0.0.1:11434)
```

**Two-tier (recommended)**:
```
[Orbitron dashboard box] ──LAN──→ [Dedicated GPU box (RTX 3090, etc.)]
.env: OLLAMA_HOST=http://192.168.219.117:11434
```

**Multi-GPU (future)**:
```
[Orbitron] ──┬──→ [GPU box A: LLMs]
             └──→ [GPU box B: video gen]
.env: OLLAMA_HOST=http://gpu-a.internal:11434
      WAN_VIDEO_HOST=http://gpu-b.internal:8200
```

Full architecture diagram: see the "Distributed GPU Routing" section in the [AI Video Generation guide](/docs-en.html#/ai-video).

---

## 🩺 Practical Use: "Where should I fix this?"

All preparations are now complete! If your container blows up (Build Failed) or crashes at runtime during a future deployment, click the red highlighted project in the bottom left.

1. Click the shiny **`💬 Request AI Analysis`** button attached next to the Log panel.
2. Copy the entirety of the angry red error text the system just spewed out for hundreds of lines, and send it to the AI brain along with your language context (Node.js, Python, etc.).
3. Just 2~3 seconds later, a reply will arrive in perfect English explaining **"why it exploded, which file to open, and exactly what line of code to modify to fix it"**! 

```markdown
> 💡 AI Analysis Result:
>
> This is a port binding conflict error!
> You already opened the server on port 3000 in `src/main.js`, but Orbitron 
> tried to open port 3000 again externally, causing a collision (EADDRINUSE).
> Please modify the code as follows.
> 
> ```javascript
> // Before modification
> app.listen(3000); 
> 
> // After modification (Allows accepting environment variables)
> app.listen(process.env.PORT || 3000);
> ```
```

Simply accept this friendly advice, immediately fix your GitHub code, and Push. Enjoy a stress-free debugging life!

---

## 🧠 Smart Project Analyzer

> ✨ **New March 2026**: In addition to AI error analysis, Orbitron now **automatically analyzes 100% of your project structure** upon deployment!

### Auto-Detected Items

When deployment begins, Orbitron's built-in **Project Analyzer** scans the entire repo and automatically figures out the following:

| Analysis Item | Detection Method | Example |
|-----------|-----------|------|
| **Runtime** | Identified via config files | `package.json` → Node.js, `requirements.txt` → Python |
| **Framework** | Dependency package analysis | `fastapi` → FastAPI, `@vitejs/plugin-react` → Vite+React |
| **Service Type** | Framework + Directory name | backend → Docker, frontend → CF Pages |
| **Port Number** | Extracted from code/settings | `--port 8000`, `process.env.PORT`, etc. |
| **Build Command** | Script analysis | `npm install && npm run build` |
| **Start Command** | Entrypoint analysis | `uvicorn main:app`, `npm start` |
| **Dependencies** | Environment variables / Directory name | frontend references backend URL |

### Deployment Log Example

```
📊 Project Structure Analysis Result (Source: auto-detect)
   Project: sodamfn
   Services: 3
   Databases: 0

   🌐 app-backend
      Type: web | Runtime: python | Framework: fastapi
      Deploy: Docker | Directory: SodamApp/backend
      Port: 8000

   📄 app-frontend
      Type: static | Runtime: node | Framework: vite-react  
      Deploy: CF Pages | Directory: SodamApp/frontend
      Depends on: app-backend

   📄 app-staff-app
      Type: static | Runtime: node | Framework: vite-react
      Deploy: CF Pages | Directory: SodamApp/staff-app
      Depends on: app-backend
```

### Works Even Without orbitron.yaml

Even for projects without an `orbitron.yaml`, the Smart Project Analyzer scans the entire repo and automatically detects all services from marker files like `package.json` and `requirements.txt`.

If `orbitron.yaml` is present, those settings function as the **absolute authority**, and the Analyzer only supplements missing information (ports, frameworks, etc.).

---

## 📚 Error Knowledge Database

> ✨ **New March 2026**: Learns past error-solving patterns to offer immediate solutions when the same error recurs!

Orbitron automatically saves AI-analyzed errors and their solutions to an **Error Knowledge Database**.

### How it Works

1. **Error Occurs** → AI analyzes to derive the root cause and solution.
2. **Pattern Saved** → Records the error message's core pattern, root cause, and solution in the DB.
3. **Instant Fix on Recurrence** → If the same pattern of error occurs again, it **instantly proposes the past solution** without needing new AI analysis.
4. **Success Logging** → Tracks how many times the same solution has succeeded, indicating a reliability metric.

### Stored Information

| Item | Description |
|------|------|
| **Error Pattern** | Core keyword of the error message (Auto-extracted) |
| **Root Cause** | Detailed explanation of why the error occurred |
| **Solution** | Specific fix instructions (can include code patches) |
| **Success Count** | Number of times this solution succeeded in the past |
| **Source** | `auto_repair`, `chat_fix` (AI chat), `manual` (Manual logging) |

### Practical Example

```
📚 Error Knowledge DB Match Result:
   Pattern: "static type service defined in orbitron.yaml is not deployed to CF Pages"
   Root Cause: deployer bypassed type:static services in the services array
   Solution: Add automated build/deploy pipeline via cfPagesDeployer service
   Success Count: 1
```

Just like this, Orbitron is a **learning deployment platform** that remembers more errors and resolves them faster over time!

---

## 🛡️ Deployment Stability Engine (New April 2026)

> ✨ **April 2026 Update**: The stability of the deployment pipeline itself has been significantly strengthened.

### 60-Minute Deployment Timeout
All deployments have a **60-minute auto-timeout**. If a deployment exceeds 60 minutes for any reason — network failures, infinite loop builds, stuck Docker processes — it is automatically terminated and transitions to `failed` status. This completely prevents zombie processes from consuming server resources.

### Automatic Log Management
*   **Log Size Limit (512KB)**: Build logs exceeding 512KB are automatically truncated. This prevents hundreds of lines of `npm install` logs or massive build outputs from bloating the database indefinitely.
*   **Container Log Rotation**: Running container logs are automatically rotated with `max-size=10MB, max-file=3` to prevent disk from filling up.

### Automatic Docker Image Cleanup
After each deployment, the following is automatically performed:
*   Immediate removal of dangling images
*   Automatic cleanup of unused images older than 24 hours
*   Automatic rollback to previous successful image on build failure (prevents service disruption)
