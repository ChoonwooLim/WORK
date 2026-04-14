# 🌐 Custom Domain with Let's Encrypt Auto-SSL

> ✨ **Updated in 2026.04 v2.4**: Connect now happens on a **dedicated wizard page** (sidebar → 🌐 Custom Domain). Adds multi-domain SAN certs, canonical redirect, search-engine registration, and provider-specific DNS guides — all in one flow.

> ✨ **New in 2026.04 v2.3**: Orbitron users can now freely point their own domain (e.g. `myapp.com`) at any project; HTTPS certificates are **issued and renewed automatically** by Let's Encrypt.

When you connect your own domain:
- Serve at **`https://myapp.com`** instead of `{subdomain}.twinverse.org`
- SSL certificates are **issued automatically** — no manual cert juggling
- **Auto-renewed** before each 90-day expiry (daily cron)
- Works directly on the Orbitron host — no Cloudflare or external CDN required

---

## ⚡ Core concepts first

**No nameserver changes.** Keep your domain at whatever registrar/DNS host you use now (Gabia, Squarespace, Cloudflare, Namecheap, Route 53…). Just add or edit 1–2 DNS records.

**One IP for all projects.** The Orbitron server has a single public IP (`116.33.16.12` in this deployment). Routing to the correct project is done by `server_name` (Host header), not by IP. So every custom-domain A record for every project points at the same IP.

## 🚀 7-step wizard (2026.04 v2.4)

Sidebar → **🌐 Custom Domain** opens a dedicated page:

### 1️⃣ Pick project — dropdown, auto-fills subdomain / tunnel URL / current domain.

### 2️⃣ Enter domain(s) — independent fields

- **Primary domain** (required) — becomes the SSL cert-name.
- **Additional domains** — click `+ 도메인 추가` to add fields, `✕` to remove. All names are bundled into one **SAN certificate**.
- **🧭 Auto-redirect checkbox** (on by default) — if on, `{subdomain}.twinverse.org` 301-redirects to `https://<primary>$request_uri` (SEO-friendly canonical).

### 3️⃣ Pick your DNS provider — 6 tiles: 🟩 Squarespace · 🇰🇷 Gabia · 🟧 Cloudflare · 🟦 Namecheap · 🟨 Route 53 · ❓ Other.

### 4️⃣ Follow the provider-specific guide

Exact menu paths, login URLs, and which existing records to delete first. Every value has a 📋 copy button.

Standard two records:

| Type | Host | Value | Purpose |
|------|------|-------|---------|
| **`A`** | `@` (apex) | `116.33.16.12` | `myapp.com` itself |
| **`CNAME`** | `www` | `{subdomain}.twinverse.org` | `www.myapp.com` |

> Apex cannot be a CNAME (RFC) — always use A for the bare domain.

### 5️⃣ DNS verify — per-domain ✅/⚠️ breakdown.

### 6️⃣ Issue + connect — Let's Encrypt SAN cert + nginx HTTPS block + reload, ~20–60 s.

### 7️⃣ Search-engine registration (SEO) — auto-opens on success

Direct links + per-service guide for: 🔵 Google Search Console · 🟢 Naver Search Advisor · 🟦 Bing Webmaster Tools · 🟠 Daum/Kakao. Verification methods, sitemap + URL with copy buttons, and a sitemap/robots/meta-tag checklist.

### 🔒 Auto-renewal is automatic

90-day certs, daily `orbitron-cert-renew.timer`, live "days left" shown in the dashboard, force-renew button available.

<!-- Legacy 3-step section (kept for backward-compat anchors) -->
## 🚀 Quick Start (3 steps)

### 1️⃣ Add a DNS record

At your registrar / DNS host (gabia, Cloudflare, Namecheap, Route53, etc.), add **one of**:

| Option | Type | Host | Value |
|--------|------|------|-------|
| **A — apex and www both work (recommended)** | `A` | `@` (apex) or `www` | **{Orbitron public IP}** |
| **B — subdomain only (no apex)** | `CNAME` | `www` or any subdomain | `{project-subdomain}.twinverse.org` |

> 💡 The public IP is shown automatically in the connect screen.

### 2️⃣ Connect in the dashboard

1. Project → **⚙️ Settings** tab
2. **🌐 Custom Domain** section — enter your domain (`myapp.com` or `www.myapp.com`)
3. **🔍 DNS Verify** → on success you see "✅ DNS verified"
4. **🔗 Connect** → Orbitron automatically:
   - Issues the SSL cert via Let's Encrypt HTTP-01 (typically 20-60s)
   - Emits an HTTPS server block into the nginx config
   - Reloads nginx
5. Done — `https://myapp.com` is live.

### 3️⃣ Auto-renewal

- Daily cron (`orbitron-cert-renew.timer`) renews certs before expiry
- Dashboard shows the remaining days (e.g. "🔐 cert expires in 83 days")
- Use the **🔄 Renew** button to force an early renewal if needed

---

## 🛡 How it works

```
 [Browser]
    │ https://myapp.com
    ▼
 [User's DNS]
    │ A record: myapp.com → <Orbitron public IP>
    ▼
 [User's router / firewall]
    │ Ports 443/80
    ▼
 [dev-nginx Docker container]
    │ server_name myapp.com → HTTPS block match
    │ SSL: /etc/letsencrypt/live/myapp.com/{fullchain,privkey}.pem
    │ proxy_pass http://orbitron-<project>-<deployHash>:<port>
    ▼
 [Project container] ✅
```

**Certificate issuance (HTTP-01 challenge)**:
1. User clicks Connect → `POST /api/projects/:id/domain/connect`
2. Orbitron runs `certbot certonly --webroot`
3. certbot writes `webroot-acme/.well-known/acme-challenge/<token>`
4. Let's Encrypt GETs `http://myapp.com/.well-known/acme-challenge/<token>`
5. dev-nginx serves the file from the mounted webroot
6. Let's Encrypt validates → cert issued
7. Cert stored at `/home/stevenlim/letsencrypt/config/live/myapp.com/` (mounted read-only into dev-nginx)
8. `services/nginx.js` regenerates the project's nginx conf with an HTTPS block
9. nginx reload → HTTPS is live

---

## 📋 FAQ

**Q1. Can I connect apex domains?**
Yes. Use option A (A record). CNAME cannot be placed at the apex per RFC; it only works on subdomains like `www.myapp.com`.

**Q2. How long does DNS propagation take?**
Most providers propagate in minutes; some up to 48h. Use **🔍 DNS Verify** anytime.

**Q3. Can I connect both `myapp.com` and `www.myapp.com`?**
**Yes — as of v2.4.** In step 2 of the wizard, put the apex in the primary field and click `+ 도메인 추가` to add the www version. Both end up on one SAN cert.

**Q3-1. How do I force everyone onto one canonical URL?**
Leave the **🧭 Auto-redirect** checkbox on (default). The tunnel subdomain will 301-redirect to your primary custom domain.

**Q4. Let's Encrypt issuance failed.**
Most common causes:
- DNS hasn't propagated yet → wait 5-10 min
- A record points somewhere other than the Orbitron IP
- Port 80 blocked by firewall
- Hit Let's Encrypt's 5/week rate limit → test with `staging=true`

**Q5. How do I force-renew?**
Dashboard → 🌐 Custom Domain → select project → **🔄 SSL 갱신** on the connected-state card. certbot will only actually renew if the cert is close to expiry; for a full reissue, disconnect and reconnect.

**Q5-1. The DNS guide shows "IP 확인 불가" — what now?**
That means the Orbitron server couldn't reach any external IP-lookup API (outbound firewall, DNS issue, transient hiccup). Fixes, in order:
- **Permanent (recommended)**: add `PUBLIC_IP=116.33.16.12` (your actual public IP) to the server's `.env`, then `pm2 reload orbitron --update-env` — the resolver returns instantly with zero network calls.
- **Temporary**: click **✏️ 수동 입력** in the guide. A modal explains how to find the public IP per deployment scenario (router-behind-NAT, cloud console, SSH + `curl icanhazip.com`) and offers four external checker links (whatismyipaddress.com, whatismyip.com, api.ipify.org, Naver search). Enter the IP → saved until next restart.
- **Diagnose**: run `curl https://api.ipify.org` on the server. If it hangs, outbound 443 is blocked — this will also break Let's Encrypt renewals, so fix the network at the infrastructure level.

**Q6. What happens to the cert when I disconnect?**
It's revoked immediately, and the local cert directory is deleted. Reconnecting issues a fresh cert.

**Q7. Should I enable Cloudflare proxy (orange cloud)?**
**DNS-only (gray cloud) is recommended during initial issuance**. Orange cloud can break the HTTP-01 challenge via caching. Once the cert is issued you can switch to orange cloud.

---

## 🛠 Advanced — Ops

### List all certificates (server shell)
```bash
certbot certificates \
  --config-dir /home/stevenlim/letsencrypt/config \
  --work-dir /home/stevenlim/letsencrypt/work \
  --logs-dir /home/stevenlim/letsencrypt/logs
```

### Renewal cron
- Unit: `~/.config/systemd/user/orbitron-cert-renew.timer`
- Runs daily at 00:45 + up to 1h random delay
- Logs: `journalctl --user -u orbitron-cert-renew -f`
- Manual run: `systemctl --user start orbitron-cert-renew.service`

### Orbitron env vars
```bash
PUBLIC_IP=116.33.16.12         # (auto-detected from api.ipify.org if unset)
LE_EMAIL=admin@twinverse.org
LE_STAGING=0                   # set to 1 for testing
LE_WEBROOT=/home/stevenlim/WORK/orbitron/webroot-acme
LE_CONFIG_DIR=/home/stevenlim/letsencrypt/config
```

### dev-nginx volume mounts (`infrastructure/docker-compose.yml`)
```yaml
volumes:
  - /home/stevenlim/letsencrypt/config:/etc/letsencrypt:ro
  - /home/stevenlim/WORK/orbitron/webroot-acme:/var/www/certbot:ro
```

### Let's Encrypt rate limits
- Per exact domain: 5 certs/week
- Per registered domain: 50 certs/week
- Use `staging=true` during development — staging quotas are much higher

---

## 🔐 Security

- Account keys and private keys are owned by the Orbitron user (`stevenlim`) with 600 perms — no other system user can read
- dev-nginx mounts `/etc/letsencrypt` **read-only** — a compromised container cannot exfiltrate or tamper with certs
- Webroot contains only transient ACME challenge files, nothing sensitive
- Only project owners can call their project's domain API (`authMiddleware + viewerGuard`)
- Admins can pass `skipVerify: true` for emergency recovery

---

## 🗺 Roadmap

| Feature | Status |
|---------|--------|
| A + CNAME support | ✅ v2.3 |
| Let's Encrypt HTTP-01 auto-issuance | ✅ v2.3 |
| Auto-renewal (systemd timer) | ✅ v2.3 |
| Certificate status UI | ✅ v2.3 |
| **Multiple custom domains per project (SAN)** | ✅ **v2.4** |
| **Dedicated wizard page + 6 provider guides** | ✅ **v2.4** |
| **Canonical redirect (tunnel → primary, 301)** | ✅ **v2.4** |
| **Search-engine registration hand-off (SEO)** | ✅ **v2.4** |
| **4-layer public-IP resolver + manual fallback UI** | ✅ **v2.4** |
| Wildcard SSL (DNS-01 challenge) | 📋 v2.5 |
| DNS-provider API integration | 📋 v2.5 |
