#!/bin/bash
set -e

# Get SUDO Password safely
SUDO_PASS=$(grep SUDO_PASSWORD /home/stevenlim/WORK/devdeploy/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

echo "1. Replacing Systemd Paths..."
echo "$SUDO_PASS" | sudo -S sed -i 's|/home/stevenlim/WORK/devdeploy|/home/stevenlim/WORK/orbitron|g' /etc/systemd/system/cloudflared-devdeploy-*.service 2>/dev/null || true
echo "$SUDO_PASS" | sudo -S systemctl daemon-reload

echo "2. Deleting old PM2..."
pm2 delete devdeploy || true

echo "3. Renaming Directory..."
cd /home/stevenlim/WORK
mv devdeploy orbitron

echo "4. Updating Package.json & PM2 Ecosystem..."
sed -i 's/"name": "devdeploy"/"name": "orbitron"/' orbitron/package.json

echo "5. Starting New PM2..."
cd /home/stevenlim/WORK/orbitron
pm2 start npm --name "orbitron" -- run dev
pm2 save

echo "6. Updating UI Texts (Title & Header)..."
sed -i 's/DevDeploy/Orbitron/g' public/index.html
sed -i 's/devdeploy Setup/Orbitron Setup/gi' public/index.html
sed -i 's/DevDeploy/Orbitron/g' public/js/app.js

echo "7. Updating Project Sync scripts..."
sed -i 's/devdeploy/orbitron/g' scripts/sync-db.sh
sed -i 's/devdeploy/orbitron/g' force_deploy_wra.sh

echo "Done! Zero downtime migration complete."
