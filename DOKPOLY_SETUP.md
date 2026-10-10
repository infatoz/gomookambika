# 🚀 Dokpoly Production Deployment Guide — Go Mookambika

This guide details how to deploy the **Go Mookambika** monorepo to production using **Dokpoly PaaS** connected to your **GitHub** repository.

---

## 🌐 Subdomain & Architecture Mapping

| Component | Subdomain / URL | Tech Stack | Container Port | Dockerfile |
| :--- | :--- | :--- | :--- | :--- |
| **Customer App** | `https://example.com` | React PWA (Vite) on Nginx Alpine | `80` | `docker/customer.Dockerfile` |
| **Driver App** | `https://captain.example.com` | React PWA (Vite) on Nginx Alpine | `80` | `docker/driver.Dockerfile` |
| **Admin Portal** | `https://admin.example.com` | React PWA (Vite) on Nginx Alpine | `80` | `docker/admin.Dockerfile` |
| **Backend API Server** | `https://api.example.com` | Express, TypeScript, Socket.IO | `5000` | `docker/server.Dockerfile` |
| **MongoDB** | Internal network (`gm-mongodb`) | MongoDB 7.0 | `27017` | Standard Image |
| **Redis** | Internal network (`gm-redis`) | Redis 7.2 Alpine | `6379` | Standard Image |

---

## ⚡ Deployment Methods in Dokpoly

Dokpoly offers two ways to deploy this project from GitHub:

1. **Option A: 1-Click Dokpoly Compose (Recommended)** — Deploys all 4 apps, MongoDB, Redis, and Traefik SSL certificates in a single coordinated stack.
2. **Option B: Separate Dokpoly Applications** — Deploys each app as an isolated container service in Dokpoly with its own build triggers.

---

### Option A: 1-Click Dokpoly Compose (Recommended)

1. Open your Dokpoly dashboard and click **New Project** $\rightarrow$ **Compose**.
2. Under **Source**, select **GitHub**, choose your repository and the `main` branch.
3. In **Compose Path**, ensure it points to `docker-compose.yml`.
4. Go to the **Environment** tab and set your domains and secrets:

```env
# Domain Configuration
DOMAIN_CUSTOMER=example.com
DOMAIN_DRIVER=captain.example.com
DOMAIN_ADMIN=admin.example.com
DOMAIN_API=api.example.com

# Database & Cache (Internal Compose services)
MONGODB_URI=mongodb://mongodb:27017/gomookambika
REDIS_URL=redis://redis:6379

# Production Security Keys (Generate strong 32+ char secrets)
JWT_SECRET=production-jwt-access-secret-minimum-32-chars-long-here
JWT_REFRESH_SECRET=production-jwt-refresh-secret-minimum-32-chars-long-here

# CORS Allowed Origins
FRONTEND_URLS=https://example.com,https://captain.example.com,https://admin.example.com

# Optional SMS / Payment integrations
OTP_PROVIDER=console
DEV_OTP_ENABLED=false
```

5. Click **Deploy**.
6. Dokpoly's built-in Traefik router will automatically:
   - Build all images in parallel with cached pnpm layers.
   - Attach your subdomains (`example.com`, `captain.example.com`, `admin.example.com`, `api.example.com`).
   - Automatically request and bind free **Let's Encrypt SSL/TLS** certificates.

---

### Option B: Deploying as Individual Applications in Dokpoly

If you prefer separate independent applications in Dokpoly (with individual rebuild webhooks on push):

> ⚠️ **IMPORTANT FOR MONOREPO BUILDS:**  
> Always keep **Docker Context** set to `.` (the root of the repo) so pnpm can access shared packages in `packages/types` and `packages/validation`.

#### 1. Backend Server (`api.example.com`)
- **App Name:** `gm-server`
- **Build Type:** `Dockerfile`
- **Build Context:** `.` (or `/`)
- **Dockerfile Path:** `docker/server.Dockerfile` (or root `Dockerfile` with Target: `server`)
- **Port:** `5000`
- **Domain:** `api.example.com`
- **Environment Variables:**
  ```env
  NODE_ENV=production
  PORT=5000
  MONGODB_URI=mongodb://<your-mongodb-host>:27017/gomookambika
  REDIS_URL=redis://<your-redis-host>:6379
  JWT_SECRET=production-jwt-access-secret-minimum-32-chars-long
  JWT_REFRESH_SECRET=production-jwt-refresh-secret-minimum-32-chars-long
  FRONTEND_URLS=https://example.com,https://captain.example.com,https://admin.example.com
  DEV_OTP_ENABLED=false
  ```

#### 2. Customer App (`example.com`)
- **App Name:** `gm-customer`
- **Build Type:** `Dockerfile`
- **Build Context:** `.`
- **Dockerfile Path:** `docker/customer.Dockerfile` (or root `Dockerfile` with Target: `customer`)
- **Port:** `80`
- **Domain:** `example.com`
- **Build Arguments:** (Optional if using direct CORS):
  ```env
  VITE_API_BASE_URL=https://api.example.com/api/v1
  VITE_SOCKET_URL=https://api.example.com
  ```
- **Runtime Environment:**
  ```env
  BACKEND_URL=https://api.example.com
  ```

#### 3. Driver App (`captain.example.com`)
- **App Name:** `gm-driver`
- **Build Type:** `Dockerfile`
- **Build Context:** `.`
- **Dockerfile Path:** `docker/driver.Dockerfile` (or root `Dockerfile` with Target: `driver`)
- **Port:** `80`
- **Domain:** `captain.example.com`
- **Build Arguments:**
  ```env
  VITE_API_BASE_URL=https://api.example.com/api/v1
  VITE_SOCKET_URL=https://api.example.com
  ```
- **Runtime Environment:**
  ```env
  BACKEND_URL=https://api.example.com
  ```

#### 4. Admin App (`admin.example.com`)
- **App Name:** `gm-admin`
- **Build Type:** `Dockerfile`
- **Build Context:** `.`
- **Dockerfile Path:** `docker/admin.Dockerfile` (or root `Dockerfile` with Target: `admin`)
- **Port:** `80`
- **Domain:** `admin.example.com`
- **Build Arguments:**
  ```env
  VITE_API_BASE_URL=https://api.example.com/api/v1
  ```
- **Runtime Environment:**
  ```env
  BACKEND_URL=https://api.example.com
  ```

---

## 🛡️ Zero-CORS & Nginx Performance Optimizations

Each frontend container is powered by `nginx:1.27-alpine` and pre-configured with:
1. **HTML5 History PushState Routing:** `try_files $uri $uri/ /index.html` prevents 404 errors on browser page reloads.
2. **PWA Cache Invalidation:** `sw.js` and `manifest.webmanifest` are served with `Cache-Control: no-cache` so users immediately receive new updates on every deploy.
3. **Static Asset Caching:** All hashed Vite CSS/JS/images in `/assets/` are cached for 1 year with `immutable`.
4. **Built-in Reverse Proxy:** If you set `BACKEND_URL`, requests to `/api/`, `/uploads/`, and `/socket.io/` are proxied directly to the backend. This eliminates browser CORS preflight overhead and cookie restrictions.
5. **Health Checks:** Built-in `/healthz` endpoint allows Dokpoly/Traefik to perform zero-downtime rolling deploys.

---

## 🗄️ Initializing Default Admin & Seed Data

Once your server is running in Dokpoly, initialize the database with default admin credentials and taxi stands:

1. In Dokpoly, click on the **Server** container $\rightarrow$ open **Terminal / Console**.
2. Run:
   ```sh
   node dist/scripts/setup.js
   ```
3. Default credentials created:
   - **Super Admin:** `admin@gomookambika.com` / `Admin@123`
   - **Association Lead:** `assoc@gomookambika.com` / `Assoc@123`
4. Login at `https://admin.example.com` to manage taxi stands, vehicles, drivers, and fixed route fares!
