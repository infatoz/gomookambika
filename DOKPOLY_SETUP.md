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

## ⚡ Deployment Architectures in Dokpoly

You can run Go Mookambika in Dokpoly in one of two architectures:

### 🌟 Architecture 1: Single Unified "All-in-One" Application (Port 80 for all 4 domains)
> **This is the setup matching your configuration:**
> `API: api.gomookambika.infatoz.com - 80`
> `Admin: admin.gomookambika.infatoz.com - 80`
> `Driver/Captain: captain.gomookambika.infatoz.com - 80`
> `Customer: gomookambika.infatoz.com - 80`

In this architecture, ONE single Dokpoly application runs Nginx + Node.js Express together. Nginx routes traffic internally based on the incoming domain Host header:
- `api.gomookambika.infatoz.com` $\rightarrow$ Proxied internally to Node.js on port 5000
- `admin.gomookambika.infatoz.com` $\rightarrow$ Admin PWA (`/var/www/admin`)
- `captain.gomookambika.infatoz.com` $\rightarrow$ Driver PWA (`/var/www/driver`)
- `gomookambika.infatoz.com` $\rightarrow$ Customer PWA (`/var/www/customer`)

#### Dokpoly Setup for All-in-One:
1. In Dokpoly, go to your **Application**.
2. **Build Type:** `Dockerfile`
3. **Dockerfile Path:** `Dockerfile` (root)
4. **Docker Context:** `.` (root)
5. **Target:** `all-in-one` (or leave blank; defaults to `all-in-one`)
6. **Port:** `80`
7. **Domains Tab:** Add all 4 domains:
   - `gomookambika.infatoz.com` (Port: 80, Certificate: Let's Encrypt)
   - `admin.gomookambika.infatoz.com` (Port: 80, Certificate: Let's Encrypt)
   - `captain.gomookambika.infatoz.com` (Port: 80, Certificate: Let's Encrypt)
   - `api.gomookambika.infatoz.com` (Port: 80, Certificate: Let's Encrypt)
8. **Environment Variables:**
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb://gomookambika:Infatoz2023@200.141.6.11:27016/gomookambika?authSource=admin&directConnection=true
   REDIS_URL=redis://redis:6379
   JWT_SECRET=production-jwt-access-secret-minimum-32-chars-long
   JWT_REFRESH_SECRET=production-jwt-refresh-secret-minimum-32-chars-long
   FRONTEND_URLS=https://gomookambika.infatoz.com,https://captain.gomookambika.infatoz.com,https://admin.gomookambika.infatoz.com
   DEV_OTP_ENABLED=false
   ```

---

### 📦 Architecture 2: 4 Separate Dokpoly Applications
If you deploy 4 separate applications in Dokpoly, the container ports MUST match:

| App Name | Dockerfile Path | Port | Domain |
| :--- | :--- | :--- | :--- |
| `gm-customer` | `docker/customer.Dockerfile` | **80** | `gomookambika.infatoz.com` |
| `gm-driver` | `docker/driver.Dockerfile` | **80** | `captain.gomookambika.infatoz.com` |
| `gm-admin` | `docker/admin.Dockerfile` | **80** | `admin.gomookambika.infatoz.com` |
| `gm-server` | `docker/server.Dockerfile` | **5000** ⚠️ *(Not 80!)* | `api.gomookambika.infatoz.com` |

---

## 🛠️ Why Updates Were Not Reflecting & How to Apply Them in Dokpoly

### Root Causes Fixed in the Codebase:
1. **Nginx Regex Order Bug**: In previous configurations, the `.js` regex rule matched before the `sw.js` rule, sending `Cache-Control: public, max-age=31536000, immutable`. Browsers cached the old service worker for **1 year**!
   - *Fix applied:* Re-ordered Nginx rules so `(sw.js|registerSW.js|manifest.webmanifest|index.html)` is evaluated first with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.
2. **Missing Workbox Auto-Takeover**: Without `skipWaiting: true` and `clientsClaim: true`, even after a new PWA bundle was downloaded, the old service worker stayed active until all browser tabs were closed.
   - *Fix applied:* Configured `skipWaiting: true`, `clientsClaim: true`, and `cleanupOutdatedCaches: true` in all 3 apps.
3. **HTML Caching**: `index.html` is now served with strict `no-store` headers so browsers always request the latest hashed JS/CSS bundles.
4. **Docker Build Layer Caching**: Added `ARG CACHEBUST` across all Dockerfiles so Docker layer caching can be invalidated.

---

### 🚀 Exactly What to Do in Dokpoly Right Now:

#### Step 1: Rebuild Without Cache in Dokpoly
1. Open the Dokpoly dashboard $\rightarrow$ Navigate to your **Application**.
2. Click the dropdown arrow next to the **Deploy** button $\rightarrow$ Select **"Rebuild without cache"** (or click **"Clear Cache & Deploy"**).
3. Wait for the build logs to finish building the fresh image.

#### Step 2: Restart / Recreate Container (Stop Orphaned Old Containers)
1. In Dokpoly, click **"Stop"** on the application.
2. Wait 5-10 seconds to allow Traefik to deregister the old container.
3. Click **"Start"** (or **"Deploy"**).
4. Verify in Dokpoly's **Logs** tab that the new container starts with:
   `Starting Go Mookambika All-In-One Unified Server`
   `[1/3] Checking Nginx configuration...`
   `[2/3] Starting Express + Socket.IO API server on port 5000...`
   `[3/3] Starting Nginx Subdomain Router on ports 80, 3000, 8080...`

#### Step 3: Browser Cache-Bust for Previous Visitors
Because previous visitors' browsers had cached the old `sw.js` under the 1-year cache header:
- **On PC / Mac:** Press `Ctrl + Shift + R` (or `Cmd + Shift + R`) or `Ctrl + F5` once on the website.
- **On Mobile:** Open browser $\rightarrow$ Refresh the page, or open in Incognito/Private window.
- **In Chrome DevTools:** Press `F12` $\rightarrow$ **Application** $\rightarrow$ **Storage** $\rightarrow$ Click **"Clear site data"**.

All subsequent visits will automatically receive updates immediately and seamlessly!

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
