# Backend Web Services

Need to deploy a Node.js, Python (Django/FastAPI), Go, or Rust live server or REST API? The **Web Services** type is the answer!

Unlike frontends that only display static files, Web Services refer to a container environment where the server is always running, communicating with databases, and processing dynamic logic.

---

## Supported Languages and Frameworks

Orbitron instantly identifies and builds the most widely used backend ecosystems worldwide, using only your source code, without the need for miscellaneous configurations (like Dockerfiles).

*   **Node.js**: Only `package.json` is required. (Full support for Express.js, NestJS, Fastify, Koa)
*   **Python**: Detects `requirements.txt` or `Pipfile` to install packages and run your application. (Automatic detection for FastAPI, Django, Flask)
*   **Go & Rust**: Automatically builds and deploys ultra-lightweight binary images, tailored to the characteristics of compiled languages.
*   **Ruby, PHP, Java**: Supports detection of `Gemfile`, `composer.json`, `pom.xml`/`build.gradle`

> 🧠 **Smart Project Analyzer (New in 2026.03)**: Automatically scans your project structure upon deployment to 100% detect runtime, framework, port, and even build commands. Optimal settings are applied even without `orbitron.yaml`. [Learn More →](#/ai-analyzer)

---

## Port Binding Rules

The most common reason for deployment failure is "the server listening on the wrong port."

> ⚠️ **Very Important**
> Container-based servers **must never directly open ports 80 or 443**, which are accessed by web browsers.

In your server startup file (e.g., `server.js` or `main.py`), you should code as follows:

### Node.js (Express) Example
```javascript
// Do not hardcode! Make sure to prioritize the PORT environment variable.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

During deployment, Orbitron automatically allocates a port to connect with your app internally and injects it as the `PORT` environment variable. Your app only needs to open this `PORT` number and wait for signals; the Orbitron Nginx router will handle the rest by forwarding frontend URL traffic to that port!

---

## Customizing Start Commands

Depending on your source code, the default command executed by the system (e.g., `npm start`) might not be suitable.
You can override this in the **Settings > Build & Run** tab of your dashboard.

*   **Build Command**: This is the preparation command executed before running your code. (e.g., `npm install && npm run build`, `pip install -r requirements.txt`)
*   **Start Command**: This is the final command that launches your web server. (e.g., `node dist/main.js`, `gunicorn myapp.wsgi`)

---

## Troubleshooting Guide

If your deployment fails and the Dashboard shows 'Failed', please check the following:
1.  **Check Build Logs**: Review the black terminal-like build window. If you see a `Module not found` error, it means a module is missing from your `package.json` or similar configuration.
2.  **IP Binding Error (Python, etc.)**: When running Flask or FastAPI, opening on localhost (`127.0.0.1`) will prevent external access. You must bind the host to `0.0.0.0` for all interfaces. (e.g., `uvicorn main:app --host 0.0.0.0`)
3.  **[AI Error Analyzer](#/ai-analyzer)**: If you're still unsure, click the `💬 AI Analyze` button. Claude AI technology will analyze your logs and diagnose precise solutions in Korean.