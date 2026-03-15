# Static Sites

Static site deployment is the optimal way to serve React, Vue, Svelte, Next.js (Static Export), and pure HTML/CSS/JS frontend projects globally at lightning speed.

Projects that only provide completed screen files, without server-side rendering (SSR) or database connection logic, do not need to use heavy servers (Web Services).

---

## ⚡ Why Static Sites?

*   **Ultra-fast CDN (Content Delivery Network)**: Your site files (images, HTML) are distributed, copied, and cached across a global edge network. When accessed from Korea, files are served from a Seoul server; when accessed from the US, they're served from an LA server, resulting in a dramatically different perceived loading speed.
*   **Zero Cost (Free)**: Since there's no need to keep server computations running continuously, no compute costs are incurred. It's provided 100% unlimited, even on the free tier.
*   **Absolute DDoS Protection**: With no server behind it, even a traffic bomb attack will be deflected by the cache network, preventing the server from going down.

---

## 🚀 Cloudflare Pages Automatic Deployment

> ✨ **New in 2026.03**: Services defined with `type: static` in `orbitron.yaml`, or apps detected as pure frontend by the Smart Project Analyzer, are **automatically deployed to Cloudflare Pages**!

### Automatic Deployment Flow

1.  **Detection** — Orbitron automatically finds frontend directories within your project
2.  **CF Pages Project Creation** — If a project with that name doesn't exist on Cloudflare Pages, it's automatically created
3.  **Build** — `npm install && npm run build` is executed (custom build commands supported)
4.  **Deployment** — The `dist` folder is uploaded to the Cloudflare Pages CDN
5.  **URL Issuance** — `https://{service-name}.pages.dev` is immediately activated

### Multi-Frontend Automatic Deployment

Even if there are multiple frontend apps in a single repository, all of them are automatically deployed individually!

```yaml
# orbitron.yaml example — Admin app + Staff app simultaneous deployment
services:
  - name: my-admin       # → https://my-admin.pages.dev
    type: static
    rootDir: apps/admin
    build:
      command: "npm install && npm run build"
    publish: ./dist

  - name: my-staff        # → https://my-staff.pages.dev  
    type: static
    rootDir: apps/staff-app
    build:
      command: "npm install && npm run build"
    publish: ./dist
    pwa: true
```

> Even without `orbitron.yaml`, the Smart Project Analyzer finds directories with React/Vue/Vite dependencies in `package.json`, automatically classifies them as `static` type, and deploys them to CF Pages.

---

## Auto-Detected Frameworks List

When you upload a ZIP file or integrate with GitHub, if any of the framework structures below are detected, Orbitron will automatically recognize it as a "static site!" and proceed with the build.

| Framework         | Detection Criteria                | Default Build Folder |
|-------------------|-----------------------------------|----------------------|
| React (CRA)       | `react-scripts` in package.json   | `build`              |
| Vite + React      | `@vitejs/plugin-react` in package.json | `dist`               |
| Vite + Vue        | `vite` + `vue` in package.json    | `dist`               |
| Vite + Svelte     | `vite` + `svelte` in package.json | `dist`               |
| Vue.js            | `vue` in package.json             | `dist`               |
| Nuxt.js           | `nuxt` in package.json            | `.output/public`     |
| Svelte / SvelteKit| `svelte` in package.json          | `dist`               |
| Angular           | `@angular/core` in package.json   | `dist`               |
| Next.js (Static)  | `next` + `output: 'export'`       | `out`                |
| Pure HTML         | `index.html` in root              | (No build required)  |

---

## Build Folder (Publish Directory) Configuration

When deploying a static site, the most important thing is the **name of the folder containing the build output**.
After writing React code and running `npm run build`, the Orbitron engine takes the resulting final distribution folder and deploys it.

However, this folder name varies by framework!
*   **React (CRA)**: `build`
*   **Vite, Vue, Svelte**: `dist`
*   **Next.js**: `out`

You must accurately enter the folder name appropriate for your framework in the **`Publish Directory`** field of the Orbitron dashboard settings to avoid 404 errors. (The default behavior is to automatically detect `dist` or `build`).

---

## Single Page Application (SPA) Routing Handling

There's a common issue with SPA frameworks like React or Vue that change URL addresses on the client side.
If a user navigates to a sub-page (e.g., `https://myapp.com/about`) and then presses **refresh (F5)**, the Nginx server will try to find an actual `about.html` file on the hard disk and return a `404 Not Found` error.

> ✅ **Automatic Routing Fallback**
> For all projects deployed in `Static Site` mode, Orbitron intelligently pre-configures proxy Nginx rules to **always respond with the top-level `index.html` file** if no file exists at the requested address. This means React Router and similar functionalities work perfectly without needing to write separate Rewrite rules!

---

## 📱 PWA (Progressive Web App) Support

Setting `pwa: true` in `orbitron.yaml` enables service worker caching, allowing the app to function offline.

```yaml
services:
  - name: my-pwa-app
    type: static
    rootDir: apps/mobile
    publish: ./dist
    pwa: true
```

> ⚠️ **Service Worker Cache Warning**: For PWA-enabled apps, an older version might remain in the user's browser's service worker cache after an update. In such cases, you can click `Unregister` or `Clear site data` in the browser's DevTools under Application → Service Workers.