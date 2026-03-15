# 🪐 RemoteAGT — AI Remote Command & Control System

RemoteAGT is the **next-generation remote monitoring system** integrated with Orbitron. You can converse with AI (Antigravity) via Telegram or KakaoTalk on your smartphone to modify code, check server status, and deploy projects.

> 💡 **One-line Summary:** Sit in a cafe and tell your smartphone "Tell me the server status", "Fix this bug", or "Deploy this", and the AI will do it all for you.

---

## 🧠 Core Feature: Antigravity AI Remote Development

This is RemoteAGT's most powerful feature. You can perform development tasks while chatting in real-time with Antigravity AI on Telegram or KakaoTalk messengers.

### What is possible?

| Feature | Example Conversation |
|------|-----------|
| 🐛 Bug Fixes | _"Korean input isn't working on the login page, fix it for me"_ |
| ✨ Adding Features | _"Add a RemoteAGT shortcut to the top menu"_ |
| 📦 Deployment | _"Deploy the changes I just made right away"_ |
| 🔍 Code Analysis | _"Explain the authentication logic structure of the current server"_ |
| 📊 Status Check | _"How much CPU and memory is the server using right now?"_ |

### Why is it innovative?

Traditional development methods required you to **open a laptop → launch an IDE → modify code → commit → deploy**. With RemoteAGT, this entire process is completed **with a single smartphone chat**.

You can develop while talking to AI on your subway commute, during lunch, or even while lying in bed.

---

## 📡 RemoteAGT Web Dashboard

RemoteAGT provides a dedicated web dashboard (`https://RemoteAGT.twinverse.org`).

### What you can see in the dashboard

- **🖥 System Resources**: Real-time visual progress bars for CPU usage, memory footprint, and disk capacity
- **🐳 Container Status**: A list of all Docker containers running in Orbitron, along with their status and image info
- **📦 Project List**: Grasp all deployed Orbitron projects at a glance
- **📋 Activity Log**: Records who performed which deployment/management tasks and when

### Administrator-only Features

Additional menus appear when logged in as a SuperAdmin:

- **👥 User Management**: View all users, change roles (User/Admin/SuperAdmin), and control account activation/deactivation
- **📜 Audit Logs**: View a chronological audit log recording all user activities like login, deployment, and settings changes
- **📊 Admin Statistics**: Total users, weekly active users, today's logins, etc.

---

## 💬 Telegram Bot Integration

You can remotely manage your server by conversing with the RemoteAGT bot in the Telegram app.

### Available Commands

| Command | Description | Usage Example |
|--------|------|-----------|
| `/start` | Start bot and welcome message | `/start` |
| `/help` | Complete command help menu | `/help` |
| `/status` | Overall system status report including CPU, memory, disk, and container counts | `/status` |
| `/containers` | List of all running Docker containers | `/containers` |
| `/projects` | List of projects registered with Orbitron | `/projects` |
| `/deploy <name>` | Remotely redeploy a specific project | `/deploy my-website` |
| `/logs <name>` | View the last 30 log lines of a container | `/logs my-website` |
| `/disk` | Detailed disk usage information | `/disk` |
| `/plan` | View the RemoteAGT construction plan | `/plan` |
| `/uptime` | Check RemoteAGT server uptime | `/uptime` |

### Setup Guide (Step-by-step for Beginners)

This guide is easy to follow even if you're creating a Telegram bot for the first time.

**Step 1: Create a Telegram Bot**

1. Open the Telegram app on your smartphone.
2. Search for `@BotFather` and start a chat.
3. Type `/newbot`.
4. Enter a name for the bot. (e.g., `MyServerAdminBot`)
5. Enter a username for the bot. (e.g., `my_server_bot`) — It must end in `_bot`.
6. Once created, a **Token** will be displayed. Copy and save this.

> Token Example: `7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Step 2: Find Your Telegram ID**

1. Search for `@userinfobot` in Telegram and start a chat.
2. Send any message, and your numeric **ID** will be displayed. Copy and save this too.

> ID Example: `123456789`

**Step 3: Apply Settings to the Server**

Enter the two values below into RemoteAGT's `.env` file:

```
TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_ADMIN_ID=123456789
```

**Step 4: Restart the Server**

```bash
pm2 restart remoteagt
```

Now, send `/start` to the bot you created in Telegram, and RemoteAGT will respond! 🎉

---

## 💛 KakaoTalk Chatbot Integration

You can achieve the same remote monitoring via KakaoTalk, the most widely used messenger in South Korea.

### Available Commands

The same commands used in Telegram are available in KakaoTalk:

| Command | Description |
|--------|------|
| `/status` | Overall system status report |
| `/containers` | Container list |
| `/projects` | Project list |
| `/deploy <name>` | Deploy a project |
| `/logs <name>` | View container logs |
| `/disk` | Disk usage |
| `/help` | Help menu |

### Setup Guide (Step-by-step for Beginners)

KakaoTalk chatbot integration has a few more steps than Telegram, but it's simple if you follow along slowly.

**Step 1: Create a Kakao Developer App**

1. Go to [Kakao Developers](https://developers.kakao.com) and log in.
2. Click **My Applications → Add Application**.
3. Enter an app name (e.g., `RemoteAGT`) and save.
4. Copy the **REST API Key** of the created app.

**Step 2: Create a KakaoTalk Channel**

1. Go to the [KakaoTalk Channel Center](https://center-pf.kakao.com).
2. Click **Create New Channel** and enter the channel info.
3. Once the channel is created, set Allow Search to **ON**.

**Step 3: Create a Chatbot in Kakao i Open Builder**

1. Go to [Kakao i Open Builder](https://chatbot.kakao.com).
2. Click **Create Chatbot** to generate a new chatbot.
3. In the left menu under **Settings → Connect Channel**, link the channel you created in Step 2.

**Step 4: Register a Skill**

1. Navigate to **Skill → Manage Skills** in the left menu.
2. Click **Register Skill**.
3. Enter the following address in the Skill URL:

```
https://RemoteAGT.twinverse.org/api/kakao/skill
```

4. Connect the registered skill to each block (status, containers, projects, etc.).

**Step 5: Apply Settings to the Server**

Enter the REST API Key into the `.env` file:

```
KAKAO_REST_API_KEY=Paste_REST_API_Key_Here
```

**Step 6: Restart the Server**

```bash
pm2 restart remoteagt
```

Now, add the channel you created as a friend in KakaoTalk and send a message. RemoteAGT will respond! 🎉

---

## 📊 Real-time System Monitoring

RemoteAGT periodically collects server status so you can view it on both the web dashboard and messengers.

### Monitored Metrics

| Metric | Description | Visualization |
|------|------|--------|
| CPU Usage | How busy the CPU currently is (%) | Progress bar |
| Memory Footprint | Used RAM / Total RAM (%) | Progress bar |
| Disk Capacity | Used SSD/HDD space / Total (%) | Progress bar |
| Container Count | Number of running Docker containers | Number |
| Container Status | Whether each container is Running/Stopped | Badge |

> 💡 **Beginner Tip**: Think of the CPU as the computer's "brain activity", memory as "desk space", and disk as "drawer capacity". Be careful if figures exceed 90%, as the server may slow down!

---

## 🛡 Role-Based Access Control (RBAC)

RemoteAGT provides a 3-tier user permission system.

| Role | Permissions | What you can do |
|------|------|---------------|
| **User** | View access | View dashboard, check personal activity history |
| **Admin** | View + Manage | Deploy, view logs, manage containers |
| **SuperAdmin** | All access | Manage users, change roles, view audit logs, view admin stats |

### Unified Authentication (Orbitron ↔ RemoteAGT)

You can automatically log into RemoteAGT with the account you registered on Orbitron. No separate sign-up is required, and you use the exact same email and password.

---

## 📜 Activity Audit Log

Automatically records exactly who did what, and when.

Examples of logged activities:
- User login/logout
- Executing a project deployment
- Viewing container logs
- Changing a user's role
- Modifying settings

> 💡 The audit log is an essential feature for security incident response and team management. You can instantly answer questions like, "Who redeployed the server last night?"

---

## 🔗 Accessing RemoteAGT

- **Web Dashboard**: [https://RemoteAGT.twinverse.org](https://RemoteAGT.twinverse.org)
- **Telegram**: Chat directly in the Telegram app after setting up the bot
- **KakaoTalk**: Chat directly in the KakaoTalk app after adding the channel

> 🎯 All RemoteAGT features are available starting from the **Pro and Up plans**.
