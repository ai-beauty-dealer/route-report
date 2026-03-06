#!/bin/bash
# Local deployment script for Route Report Backend to VPS

VPS_IP="158.101.144.185"
PEM_KEY="/Users/bunchaca/.ssh/oracle_cloud.key"
DEST_DIR="/home/ubuntu/bots/route-report-backend"

echo "Deploying backend to VPS: $VPS_IP..."

# Upload files (excluding node_modules and certs if any)
scp -i "$PEM_KEY" server.js server.vps.js package.json customers.json .env.example ubuntu@"$VPS_IP":"$DEST_DIR/"

# Remote installation and setup
ssh -i "$PEM_KEY" ubuntu@"$VPS_IP" << EOF
  cd $DEST_DIR
  mv server.vps.js server.js
  npm install
  # Note: .env should be manually configured or copied if safe
EOF

echo "Deployment complete."
