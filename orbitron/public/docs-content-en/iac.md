# Infrastructure as Code (orbitron.yaml) Complete Guide

Are you a veteran server developer who finds it tedious to navigate dashboard screens and manually tweak settings?

**Infrastructure as Code (IaC)**, the feature that lets you 'code your infrastructure', allows you to completely automate all deployment settings (ports, start commands, environment variables, etc.) like a robot without even logging into the dashboard. Simply drop a small text document named `orbitron.yaml` into the root directory of your project's source folder.

---

## 📄 Basic Design Philosophy (How it Works)

1. When the Orbitron system pulls code from GitHub, the very first thing it does is search for an `orbitron.yaml` file hidden in the root directory.
2. If found, it reads the specifications in this YAML file as the **absolute priority (Override)** over any values you may have entered in the dashboard's web UI forms, and swiftly builds the container environment.
3. Therefore, whenever your code logic changes and requires a different Start Command, you never need to visit the dashboard. Just push a single line change in your YAML file along with your source code, and your server architecture will automatically adapt!

---

## 🧠 Smart Project Analyzer

> ✨ **March 2026 Update**: Orbitron automatically scans 100% of your project structure even without an `orbitron.yaml` file!

Orbitron's built-in **Smart Project Analyzer** automatically detects the following upon deployment:

| Analysis Item | Description |
|-----------|------|
| **Runtime** | Node.js, Python, Go, Rust, Ruby, PHP, Java, Static |
| **Framework** | 20+ including FastAPI, Django, Express, NestJS, Vite, Next.js, CRA, etc. |
| **Service Type** | `web` (Docker), `static` (CF Pages), `worker` (Background) |
| **Port** | Auto-extracts ports from code/settings, applies framework defaults |
| **Build/Start Command** | Auto-extracts from `package.json`, `requirements.txt`, etc. |
| **Dependencies** | Automatically infers frontend→backend, backend→database relationships |
| **Deploy Order** | Determines optimal deployment sequence via topology sorting based on dependencies |

If an `orbitron.yaml` exists, it is used as the **Authoritative Source**. If not, the auto-analysis results are applied.

---

## 🏗 Basic Structure — Single Service

Simply define your app under a single `services` block and you're done.

```yaml
# orbitron.yaml — Simplest form
services:
  web:
    build_command: "npm install && npm run build"
    start_command: "npm start"
    port: 3000
    env:
      - "NODE_ENV=production"
      - "API_VERSION=v2.5.1"
```

---

## 🚀 Multi-Service Deployment

> ✨ **New March 2026**: When multiple apps (backend, frontend, staff app, etc.) coexist in a single repo, defining them all in the `services` array **automatically deploys each service to the correct target!**

### Deployment Targets by Service Type

| Type | Deployment Target | Description |
|------|-----------|------|
| `web` | Docker Container | Server-side app (FastAPI, Express, Django, etc.) |
| `static` | Cloudflare Pages | Pure frontend (React, Vue, Vite, etc.) — **Auto CDN Global Deploy** |
| `worker` | Docker Container (No Port) | Background tasks (queue consumers, cron, etc.) |

### Full Multi-Service Syntax

```yaml
# orbitron.yaml — Store Management System (Backend + Admin App + Staff App)
project:
  name: sodam-fn
  region: ap-northeast-2  # Seoul

services:
  # ─── Backend API ───
  - name: sodam-backend
    type: web
    runtime: python
    rootDir: SodamApp/backend
    build:
      command: "pip install -r requirements.txt"
    start:
      command: "gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT"
    env:
      - key: DATABASE_URL
        from: database.sodam-db.connectionString   # ← Auto DB connection!
      - key: SECRET_KEY
        generate: true                              # ← Auto secret generation!
      - key: STAFF_APP_URL
        from: service.sodam-staff.url               # ← Auto URL injection between services!
    healthCheck:
      path: /api/health
      interval: 30

  # ─── Admin Frontend (Vite + React) ───
  - name: sodam-frontend
    type: static              # ← Auto deploy to Cloudflare Pages!
    rootDir: SodamApp/frontend
    build:
      command: "npm install && npm run build"
    publish: ./dist
    env:
      - key: VITE_API_URL
        from: service.sodam-backend.url
    routes:
      - source: "/*"
        rewrite: /index.html   # SPA routing fallback

  # ─── Staff PWA App ───
  - name: sodam-staff
    type: static
    rootDir: SodamApp/staff-app
    build:
      command: "npm install && npm run build"
    publish: ./dist
    env:
      - key: VITE_API_URL
        from: service.sodam-backend.url
    pwa: true                  # Enable PWA (Service Worker)

databases:
  - name: sodam-db
    engine: postgres
    region: ap-northeast-2
    plan: starter
```

### `from:` Reference Syntax (Auto-connection between services)

There's no need to hardcode URLs or connection strings between services! If you reference another service/database using the `from:` keyword, Orbitron will automatically substitute it with the actual value during deployment.

| Reference Syntax | Description |
|-----------|------|
| `service.{name}.url` | Deployment URL of the respective service |
| `database.{name}.connectionString` | DB connection string |
| `generate: true` | Auto-generates a random secret key |

---

## 💡 Practical Framework Examples

### 1. Next.js (SSR Node Environment)

```yaml
services:
  web:
    type: web-service
    build_command: "npm ci && npm run build"
    start_command: "npm run start"
    port: 3000
    env:
      - "NODE_ENV=production"
```

### 2. Python Django + Gunicorn (Bulletproof Server)

For Python, you should absolutely never deploy to production using the built-in `manage.py runserver`! You must strictly `pip install gunicorn` beforehand and run it with the robust `gunicorn` bulletproof server module to prevent pipelines from bursting under dozens of concurrent connection traffic.

```yaml
services:
  web:
    type: web-service
    build_command: "pip install -r requirements.txt && python manage.py migrate"
    start_command: "gunicorn myproject.wsgi:application --bind 0.0.0.0:8000"
    port: 8000
    env:
      - "DJANGO_SETTINGS_MODULE=myproject.settings.prod"
```

### 3. Static Site React CRA (Vite, Svelte, etc.)

```yaml
services:
  web:
    type: static-site
    build_command: "npm install && npm run build"
    publish_dir: "build"  # Write "dist" if using Vite or Svelte
```

---

## 🔄 Automated Deployment Pipeline Flow

Deployment process of a project with `orbitron.yaml`:

1. **📥 Fetch Source Code** — clone/pull from GitHub
2. **🧠 Analyze Project Structure** — Parse `orbitron.yaml` or auto-detect (Smart Project Analyzer)
3. **📊 Generate Manifest** — Finalize all service lists, types, and dependencies
4. **📄 Deploy Static Services** — `type: static` → Cloudflare Pages auto build/deploy
5. **🔨 Build Docker Images** — `type: web` → Docker container build/start
6. **🌐 Proxy Configuration** — Auto-renew Nginx reverse proxy
7. **🔗 Tunnel Connection** — Activate external access via Cloudflare Tunnel
8. **✅ Deployment Complete** — Whether it's 3, 5, or 10 services, it's done in a single redeployment!

Very simple, isn't it? Like a smart genie, Orbitron reads this single sheet of paper and builds your infrastructure.
