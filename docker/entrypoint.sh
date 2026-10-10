#!/bin/sh
set -e

echo "=================================================="
echo " Starting Go Mookambika All-In-One Unified Server "
echo "=================================================="

# Ensure runtime, log, and uploads directories exist with full permissions
mkdir -p /app/server/uploads /run /run/nginx /var/log/nginx /var/lib/nginx/tmp /var/www
chmod -R 777 /app/server/uploads /run/nginx /var/log/nginx /var/lib/nginx /var/www 2>/dev/null || true

# Symlink Nginx access/error logs to stdout/stderr for Docker log viewer
ln -sf /dev/stdout /var/log/nginx/access.log 2>/dev/null || true
ln -sf /dev/stderr /var/log/nginx/error.log 2>/dev/null || true

# Fallback if MONGODB_URI is empty or still pointing to unreachable placeholder
if [ -z "$MONGODB_URI" ] || [ "$MONGODB_URI" = "mongodb://mongodb:27017/gomookambika" ] || [ "$MONGODB_URI" = "mongodb://localhost:27017/gomookambika" ]; then
    export MONGODB_URI="mongodb://gomookambika:Infatoz2023@200.141.6.11:27016/gomookambika?authSource=admin&directConnection=true"
fi

# Verify Nginx configuration syntax
echo "[1/3] Checking Nginx configuration..."
nginx -t

# Start Node.js API server in the background
echo "[2/3] Starting Express + Socket.IO API server on port 5000..."
cd /app/server
node dist/app.js &
NODE_PID=$!

# Graceful shutdown handler
shutdown() {
    echo "Received termination signal. Shutting down gracefully..."
    kill -TERM "$NODE_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    exit 0
}

trap shutdown SIGTERM SIGINT

# Start Nginx in background
echo "[3/3] Starting Nginx Subdomain Router on ports 80, 3000, 8080..."
nginx

# Check Nginx status
sleep 1
if pgrep nginx > /dev/null 2>&1; then
    echo "✅ Nginx is running on ports 80, 3000, 8080"
else
    echo "❌ WARNING: Nginx failed to start! Check /var/log/nginx/error.log"
    cat /var/log/nginx/error.log 2>/dev/null || true
fi

echo "All services running! Listening on ports 80, 3000, 8080 (HTTP Web & Routing) and 5000 (Internal API)."

# Wait for the Node.js process. If it crashes, the container stops and Dokpoly restarts it.
wait "$NODE_PID"
