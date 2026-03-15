# Orbitron Core Concepts

Here are 3 core concepts and principles briefly explained to help you utilize Orbitron at 200%.

---

## 1. GitHub Sync and Zero-Downtime CI/CD

The days of SSH-ing into cloud servers, typing `git pull`, and running `pm2 restart` every time are over.
Orbitron flawlessly syncs with your GitHub repositories.

### How it Works
*   The moment you write code locally (like in VS Code) and push it to the `main` branch on GitHub!
*   Orbitron's Webhook listeners detect this in just 0.1 seconds.
*   It pulls your new code in the cloud and starts a fresh **Build** inside an empty container.

> ⚡ **Flawless Zero-Downtime Switching**
> Even while the server is newly updating (building), existing site visitors will experience zero drops or errors. This is because we only route the stream of user traffic (Snap Switching) at the precise split-second the new container is confirmed to be 100% operational in the background. Only then does the older version quietly disappear.

---

## 2. Integrated Project Environments

In Orbitron, multiple ecosystems can exist together within a **single identical project card**.
There is no need to forcefully split your frontend and backend into separate projects.

*   **Monorepo Support:** What if your folder structure is clearly divided into a `frontend/` framework and a `backend/` server? The Orbitron engine automatically detects this as a 'Full-stack App', deploying the frontend as a static CDN and the backend as Node.js containers respectively, all on its own!
*   **🧠 Smart Project Analyzer (New March 2026):** Going beyond simple full-stack, it auto-detects everything even if you have 3, 5, or 10 apps inside a repo! Backends become Docker, frontends become Cloudflare Pages CDNs, workers become portless background containers — it automatically selects the perfect target for each service. [Defining multi-services via `orbitron.yaml` →](#/iac)
*   **Environment Variables:** You should never hardcode database passwords, API keys, etc. Let the project's `Settings` tab handle 'Environment Variables'; they will be safely injected into the system at build and runtime.

---

## 3. Isolated Containers and Security Network

Security and stability are Orbitron's highest priorities.

### Container Orchestration
All user web services, background workers, and databases run inside entirely independent, Linux-based **Docker container** spaces. Even if User A's server spikes, resources are strictly isolated to ensure User B's server doesn't experience even a 1% performance drop.

### Global Tunnel Edge (Cloudflare Tunnels)
Projects deployed on Orbitron fundamentally start in a state where **"they cannot be accessed directly via IP from the internet (outside world)."**
*   Instead, we open a single, sturdy 'secret tunnel' extending out to Cloudflare networks, the world's #1 CDN network.
*   Only by breaking through the Cloudflare Edge network, which natively blocks hackers' DDoS attacks, can global users finally traverse this tunnel and reach your secure containers.
*   During this process, ** HTTPS Free SSL Custom Domains (`*.twinverse.org`) ** are also automatically applied.

---

Did you understand the most basic concepts?
Go ahead and [deploy a Backend API server](#/web-services) right now, or try [integrating a Database](#/postgresql)!