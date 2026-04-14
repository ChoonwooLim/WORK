# 🌐 Custom Domain with Let's Encrypt Auto-SSL

> ✨ **New in 2026.04 v2.3**: Orbitron users can now freely point their own domain (e.g. `myapp.com`) at any project; HTTPS certificates are **issued and renewed automatically** by Let's Encrypt.

When you connect your own domain:
- Serve at **`https://myapp.com`** instead of `{subdomain}.twinverse.org`
- SSL certificates are **issued automatically** — no manual cert juggling
- **Auto-renewed** before each 90-day expiry (daily cron)
- Works directly on the Orbitron host — no Cloudflare or external CDN required

---

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
MVP supports one custom domain per project. Alternatives: configure a DNS-level redirect at your provider, or create two projects. Multi-domain support is planned for v2.4.

**Q4. Let's Encrypt issuance failed.**
Most common causes:
- DNS hasn't propagated yet → wait 5-10 min
- A record points somewhere other than the Orbitron IP
- Port 80 blocked by firewall
- Hit Let's Encrypt's 5/week rate limit → test with `staging=true`

**Q5. How do I force-renew?**
Dashboard → project settings → 🌐 Custom Domain → **🔄 Renew**. certbot will only actually renew if the cert is close to expiry; for a full reissue, disconnect and reconnect.

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
| Multiple custom domains per project | 📋 v2.4 |
| Wildcard SSL (DNS-01 challenge) | 📋 v2.4 |
| DNS-provider API integration | 📋 v2.5 |
