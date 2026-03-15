# Fully Managed PostgreSQL Database (Managed DB)

Do you need a clean, empty vessel to store Persistent Data that must never be erased, such as user signup information, posts, or payment histories?

With just two button clicks on the dashboard—no need to type terminal commands—a stable, remote PostgreSQL database is instantly provisioned (allocated) and ready for connection.

---

## 🗄 Issuance & Connection (Connection String)

1. Click the `+ New Project` button on the Orbitron dashboard, then click the **🗄 Database** tab at the top of the modal window.
2. Select `PostgreSQL` as the engine type and create it.
3. A few seconds later, the most crucial **Connection String** will appear on the project card.

```
postgresql://orbit_user:secretpass123@your-db-host:5432/orbit_db
```

This single line long address combines the username (`orbit_user`), password (`secretpass123`), host address, and the actual database name (`orbit_db`) all in one. Copy this entire address.

### Code Integration (Environment Variable Injection)

Absolutely never hardcode this address into the settings file or code of the web app you are deploying (Django, NestJS, Prisma, etc.)!
Instead, go to the **Environment Variables** section in the settings of that web app project and register the value under the name `DATABASE_URL`. When the server boots up, the framework will automatically initiate communication with this DB.

---

## 🔒 Private Security Policy

The issued database is fundamentally completely **Locked**.
Unlike Google Cloud or AWS, port 5432 is not left wide open to the internet. (Perfectly blocks brute-force attacks by hackers)

*   **Internal Network Access:** The internal virtual router (vRouter) only permits connection attempts (`postgresql://...`) originating from your app (web service container) running inside the Orbitron system.
*   **No Access via External Tools:** If you attempt to connect directly to this cloud DB using GUI tools like DBeaver or DataGrip from your home computer (local), the connection will be rejected (Timeout). Accessing from the outside requires workaround methods like [Proxy Tunneling (Upcoming)](#/networking).

---

## Data Retention and Pricing

While the source code containers (web app services) deployed to Orbitron can be deleted and rebuilt at any time with the code intact, a database is permanently destroyed the moment you hit the delete button.
Storage is provided on an SSD basis. If extreme capacity expansion is required, please refer to the [Storage Pricing Guide](/pricing.html).
