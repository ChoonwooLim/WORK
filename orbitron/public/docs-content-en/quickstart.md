# Quick Deployment Guide (Quickstart)

Orbitron is the **ultimate fully-automated deployment dashboard** that allows anyone to turn their code into a live service with just a few clicks, without needing complex server headcount or infrastructure knowledge like Kubernetes.

This guide will walk you through the fastest and easiest way to publish your first application to the internet.

---

## 🚀 Deploying Your First Project

Let's deploy your very first, basic frontend or backend application.

### Step 1: Accessing the Dashboard
1. Click the **[Dashboard Login]** button on the top menu bar of the Orbitron main homepage to access the system.
2. If you don't have an account, you can sign up and log in simultaneously in just 1 second by linking your GitHub account.

### Step 2: Creating a New Project
1. Click the purple **`+ New Project`** button in the top right corner of the Overview dashboard screen.
2. In the summary window that opens, select the type of service you want to deploy (Web Service, Static Site, etc.). If it's your first time, we recommend the most fundamental **🌐 Web Service**.

### Step 3: Connecting Source Code
This is the most important step for linking your source code. Orbitron fully supports two methods.

*   **Method A (Recommended): GitHub Repository Integration**
    *   Copy and paste your **GitHub Repository URL** into the text box provided. (e.g. `https://github.com/username/my-awesome-app`)
    *   Using this method allows you to instantly utilize the **CI/CD feature**, which automatically redeploys your app whenever the code is modified.
*   **Method B: Simple ZIP Upload**
    *   Are you still unfamiliar with GitHub, or do you just want to deploy simple HTML files?
    *   Simply compress the entire folder containing your source code into a `.zip` file, and drag and drop it into the browser window. That's it!

### Step 4: Starting the Deployment
1. Once your source code is successfully recognized, the **[Create Project]** button at the bottom will activate.
2. Boldly click the button!

> 💡 **Beginners, Rest Assured!**
> There is absolutely no need to connect domains, configure port forwarding, or manually set up Nginx. The Orbitron system automatically handles dozens of tedious terminal tasks required for deployment—like installing NVM, downloading packages, and opening firewalls—in the background within 1-2 minutes.

In just 1-2 minutes, a unique secure URL (e.g. `https://my-awesome-app.twinverse.org`) will be assigned, and your service will be published to the entire world! 🎉 

---

## 🔄 Next Steps
*   Want your server to automatically update when your code changes? 👉 **[Learn about GitHub Auto Deployment (Zero-Downtime CI/CD)](#/core-concepts)**
*   Need a database? 👉 **[Get a free PostgreSQL instance](#/postgresql)**
