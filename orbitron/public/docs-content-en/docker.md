# Custom Docker & Multi-Deployment (Docker Compose)

Going beyond simple Node.js or Python apps, this is an advanced feature used when you need to deploy custom images based on a `Dockerfile` that sets up your own entire OS environment, or when you need to package and deploy multiple containers as one.

---

## 1. Single Docker Deployment (Dockerfile)

If a `Dockerfile` exists at the root of your project folder, Orbitron instantly halts static site or basic web service build pipelines and initiates the **Docker Build engine**.

1. Push your `Dockerfile` to your GitHub repository.
2. Deploy as a `Web Service` from the Orbitron dashboard.
3. The system will output all `layers` building steps to the logs and complete the build.

> 📝 **Notes on Docker Deployment (EXPOSE)**
> For the Orbitron router to safely forward external port 80/443 traffic inside your container, you must declare an `EXPOSE 3000` (or whatever port you use) command inside the `Dockerfile`. Only then will Orbitron know which port to forward traffic to.

> ⚠️ **NPM Build Error Warning (postinstall & Prisma)**
> `postinstall` scripts in your `package.json` (such as `prisma generate`) execute during the `npm install` phase before your source code is fully copied into the image, which often causes **Docker build failures**.
> If a build fails, Orbitron **automatically rolls back to the last successful image** to prevent downtime! (This results in old code being deployed).
> To prevent this, Orbitron's automated builder uses the `--ignore-scripts` flag. Therefore, ensure you run Prisma generators etc. explicitly inside your build scripts (`npm run build`) or your container startup command (`CMD`).

> 💡 **Next.js Auto System Dependency Injection (apk add)**
> When deploying Next.js, Orbitron's smart builder analyzes the `package.json`. If media packages like `yt-dlp`, `ffmpeg`, `youtube`, or image libraries like `canvas` are detected, it will automatically install the necessary OS-level system packages (e.g., python3, ffmpeg, cairo-dev) via `apk add` on the base image. Additionally, it will load custom OS packages if an `apk.txt` or `apt.txt` file exists in the project root.

> 🔌 **Managed Database Local Port Forwarding**
> When deploying PostgreSQL or Redis, Orbitron will retain internal network isolation while automatically port-forwarding (`-p`) the assigned external port (e.g., 3776) to the internal DB port. This allows you to freely connect to your managed database using `localhost:3776` from local development tools like DBeaver or Prisma Studio.

---

## 2. Multi-Container (Docker Compose) Orchestration

Do you want to deploy a massive full-stack system where multiple separate containers—a frontend (`React`), an API server (`Django`), a proprietary cache memory (`Redis`), and worker processes (like `Celery`)—interlock organically as one?

Orbitron is a powerful orchestrator with perfect `docker-compose.yml` reading support. With just a single click and push, multiple virtual servers boot up simultaneously like a legion.

### How to Use (Smart Routing)

1. Place the `docker-compose.yml` (or `.yaml`) file at the root of your project folder.
2. When deploying from the dashboard, Orbitron transcends single image builds and launches the entire stack simultaneously in the background.
3. **Routing Magic:** Among all containers, it needs to find the **single main service that must be exposed to the external internet (the contact point with the user's browser)**. Orbitron primarily hunts down blocks with service names like `web`, `app`, or `api` within your yml file to connect them as the destination (port forwarding) for global external traffic.

### `docker-compose.yml` Example

In the example below, Orbitron independently determines that the `web` service is the door meeting the user, and plugs the external hostname (Twinverse) into port 3000!

```yaml
version: '3.8'

services:
  web:                     # <-- Orbitron automatically targets this as the main destination for global routing.
    build: 
      context: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - api-server

  api-server:              # This is the backend API (called by the web service)
    build: 
      context: ./backend
    environment:
      - REDIS_URL=redis://redis-cache:6379

  redis-cache:             # This is a cache memory container running only internally
    image: redis:alpine
    # No need to expose ports externally, so they are omitted
```

### Tips for Utilizing Docker Compose
* Each container can communicate with others using the exact **Service Names assigned in the file (e.g., `api-server`, `redis-cache`)** as their domain address (Host).
* Things like worker nodes that only run in the background just need to be defined without port settings, and they will run on their own.
