# Cloudflare Tunnels & Custom Domain Networking

When connecting your project server to the public internet, the archaic method of router port-forwarding or forcibly leaving dangerous ports open is the absolute worst choice for security.

The moment your application is deployed, Orbitron automatically opens a global breakwater—a **Cloudflare Edge pipe tunnel**—that defends all applications against hacker attacks.

---

## 🛡️ The Magic of Cloudflare Tunnels

Users (developers) do not need to possess any complex networking knowledge.
The moment the system Deploys your service, the background engine communicates with the Cloudflare API to construct the following miraculous security net in just 1 second:

1.  **Perfect DDoS Defense:** Even if hackers mobilize 100,000 zombie PCs to simultaneously attack your server's address, the global Cloudflare network absorbs and deflects the entire traffic bomb. The actual CPU of your Orbitron server won't be taxed even 1%.
2.  **Stealthy Outbound Connections:** All "Inbound" doors from the outside world (the internet) to your server's public IP address are completely blocked. User data securely travels back and forth solely through a single thin tunnel pipe that your server punched "Outbound" toward Cloudflare from the inside.
3.  **Free Automated SSL Certificates:** You no longer need to manually issue Let's Encrypt certificates every time for secure HTTPS padlock connections. Bank-grade TLS security is permanently & automatically applied the moment the tunnel is established.

---

## 🌐 Auto-assigned Domains (`twinverse.org`)

When you deploy a new project, a subdomain is automatically assigned based on the project's name (e.g., `my-cool-app`). You can immediately show off your service to your friends using an address like the one below, without needing to touch any DNS settings.

```
https://my-cool-app.twinverse.org
```

This unique address permanently belongs solely to 'that specific project card', regardless of whether it's a backend, web service, or frontend.

---

## 🔗 Connecting Custom (Personal) Domains

You can connect an awesome domain you purchased yourself (e.g., `www.steven-company.com`) to your project.

### Connection Process (3 Steps)

You can easily configure this in the **Settings > Custom Domain** section of the Orbitron dashboard:

1.  **Enter Domain**: Enter the domain address you wish to connect (e.g., `app.mycompany.com`).
2.  **DNS Verification**: Click the "Verify DNS" button, and the system will automatically check if the DNS records for that domain are configured correctly.
3.  **Auto Connection**: Once verified, a single click on "Connect" automatically configures Cloudflare Tunnel DNS routing, Nginx reverse proxies, and SSL certificates all at once.

### DNS Setup Guide After Purchasing a Domain

In the DNS management page of the registrar where you purchased your domain (Gabia, Namecheap, etc.), add a **CNAME record** as follows:

| Item | Value |
|------|-----|
| **Type** | CNAME |
| **Name/Host** | `@` or your desired subdomain (e.g., `www`, `app`, etc.) |
| **Value/Target** | `{ProjectSubdomain}.twinverse.org` |
| **TTL** | Auto or 300 |

> **💡 Tip:** Some registrars do not allow CNAME on the root domain (`example.com` itself). In such cases, configure it as a subdomain like `www.example.com`.

#### Gabia Setup Example

1. Gabia Management Console → Domain Management → DNS Settings
2. Add Record: Type `CNAME`, Host `www`, Value `my-cool-app.twinverse.org`
3. After saving, click "Verify DNS" on the Orbitron dashboard

#### Namecheap Setup Example

1. Namecheap Dashboard → Domain List → Manage → Advanced DNS
2. Add New Record: Type `CNAME`, Host `www`, Value `my-cool-app.twinverse.org`
3. After saving, click "Verify DNS" on the Orbitron dashboard

#### Cloudflare Setup Example

1. Cloudflare Dashboard → DNS → Records → Add Record
2. Type `CNAME`, Name `www`, Target `my-cool-app.twinverse.org`, Proxy off
3. After saving, click "Verify DNS" on the Orbitron dashboard

---

## 🔜 Domain Purchasing Feature (Upcoming)

> **🚧 This is a planned future update**

We are preparing a one-stop feature to let you search and purchase domains directly within the Orbitron dashboard:

| Feature | Description | Status |
|------|------|------|
| **Domain Search** | Real-time search for the registration availability of desired domain names within the dashboard | 🔜 Upcoming |
| **1-Click Purchase** | Instantly purchase domains via Gabia Reseller API or Namecheap API | 🔜 Upcoming |
| **Auto DNS Integration** | CNAME records are auto-configured upon purchase, requiring no separate DNS setup | 🔜 Upcoming |
| **Domain Renewal Mgmt** | Expiration notifications and auto-renewal | 🔜 Upcoming |
| **Payment integration** | Integrated with PG providers for domain cost payments | 🔜 Upcoming |

### API Partners Under Review

- **Gabia**: Optimized for the Korean market, OAuth 2.0 REST API, strong .kr domains — Reseller partnership contract required
- **Namecheap**: Global TLD support, Sandbox testing environment, comprehensive domain management API
- **Cloudflare Registrar**: Cost-price domain registration, seamless integration with our existing infrastructure — Enterprise plan required
