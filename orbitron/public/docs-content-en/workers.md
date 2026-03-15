# Background Workers Deployment

There are processes that are not assigned any screen (UI) accessible via a web browser or any external API address (URL Domain), but **must run silently, continuously, and without failure, 365 days a year, behind the scenes of the vast internet stage.**

At Orbitron, these are called **Background Workers**. They furiously execute internal logic and are kept alive (Keep-Alive) in a completely isolated container environment, without opening any external port access.

---

## 🛠 When to Use Workers?

They are primarily useful for running periodic tasks (schedulers) or bot programs like the following:

*   **Discord / KakaoTalk Chatbots:** Code where the bot program itself maintains a 24-hour connection and listens to the messenger server, rather than users connecting to it.
*   **Periodic Scheduler Algorithms (Cron Job):** Scripts that batch update customer databases or process billing charges every day at precisely midnight.
*   **Event Stream Detection (Queue Consumption):** Consumer containers that continuously pull and process backlogged workloads (e.g., 100 image resizes, 1000 email dispatches) accumulated in message queue channels like Kafka or RabbitMQ.
*   **Crawlers (Web Scrapers):** Do you scrape Bitcoin exchanges or stock websites 24 hours a day? This is a perfect background task that requires no open ports.

---

## 🚀 Usage Guide

The setup for running a background worker is similar to a regular web service, but with a few crucial differences.

### Worker Project Creation
1. From the `+ New Project` modal in the top right of the dashboard, click on the third tab from the left, **⚙️ Background Worker**, to proceed.
2. Similar to a regular deployment, enter the GitHub repository URL containing the source code for your bot or scheduler that will run indefinitely, or upload a ZIP file.
3. Select your deployment environment (e.g., Python, Node) and click Create.

### ⚠️ Crucial Difference: Do NOT `bind`!
The most important point to note is that you **must not attempt to forcibly allocate or bind a specific port** (`server.listen(3000)`, `app.run(port=8080)`, etc.) within your worker code. External browser access is completely blocked at a system level, which will only lead to meaningless errors.

Simply run your Python code with an infinite loop (`while True:`) or launch a scheduler framework object normally, ensuring it doesn't terminate.

*   **Web Service Container:** An environment with open ports, where Cloudflare and Nginx routers await at the front, mediating user traffic.
*   **Worker Container:** An isolated environment that removes all of the above, running furiously on its own, supplied only with CPU and memory resources within the OS.

---

## What if the Bot Crashes?

Rest assured! Don't worry if your bot crashes or stops unexpectedly in the middle of the night due to bugs in your code (e.g., out of memory, reference errors).
Orbitron kernel's daemon manager system monitors the container's health heartbeat, and as soon as an abnormal process termination is detected, it **instantly revives the worker by launching a new container within just 1 second, without any notification.** (Self-Healing mechanism fully operational 24/7)