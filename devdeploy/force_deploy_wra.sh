#!/bin/bash
set -e
echo "🚀 Starting manual forced deployment for WRA without Docker cache..."

cd /home/stevenlim/WORK/devdeploy/deployments/wra

echo "🔨 Building Docker image (this will take a few minutes)..."
docker build --no-cache -t orbitron-wra .

echo "🛑 Stopping existing container..."
docker stop orbitron-wra || true
docker rm orbitron-wra || true

echo "🚀 Starting new container..."
docker run -d --name orbitron-wra --restart unless-stopped --network infrastructure_dev-network --env-file .env -p 3480:3000 orbitron-wra

echo "✅ WRA deployment successfully forced!"
