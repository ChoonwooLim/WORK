# Genius AI Assistant (Error Troubleshooting)

Have you ever panicked during a deployment when your terminal was filled with an endless stream of angry red error logs on a black screen?

> `ModuleNotFoundError: No module named 'django.core.wsgi'`
> `Error: listen EADDRINUSE: address already in use :::3000`

When facing such nightmare errors, you normally waste dozens of minutes scouring Google or Stack Overflow. But behind the Orbitron system, **ultra-precise AI engineers (Claude, Gemini)** are on standby to instantly decipher your error codes in just 1 second.

---

## 🔑 How to Setup the AI Assistant

To use this feature, you must manually plug in the API Key (the key that borrows the AI brain). Do this just once, and you'll have a dedicated coding secretary for life.

1.  Enter the **`Settings`** menu by clicking the gear icon in the top right corner of the dashboard.
2.  Click the **`LLM Settings`** tab, and you will see Google's paramount AI window (Gemini) and Anthropic's Tier-1 coding-specialized AI window (Claude).
3.  Go to your preferred company's website, sign up, get your free `API Key (Secret Key)`, paste it into the blank field, and click Save.
4.  Now, the AI Brain Activation Switch at the bottom of the system dashboard will turn green (ON).

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
