#!/bin/bash
set -e
SUDO_PASS=$(grep SUDO_PASSWORD /home/stevenlim/WORK/orbitron/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

echo "$SUDO_PASS" | sudo -S sed -i 's/devdeploy/orbitron/g' /etc/systemd/system/devdeploy.service || true
echo "$SUDO_PASS" | sudo -S mv /etc/systemd/system/devdeploy.service /etc/systemd/system/orbitron.service || true
echo "$SUDO_PASS" | sudo -S systemctl daemon-reload
echo "$SUDO_PASS" | sudo -S systemctl enable orbitron.service

echo "Done Systemd Update"
