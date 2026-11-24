#!/usr/bin/env bash
# One-time instance setup. Run ON the EC2 instance (Amazon Linux 2023) as ec2-user:
#   bash setup-ec2.sh
set -euo pipefail

# 1 GB RAM is tight for three Node processes: add 2 GB swap once.
if ! swapon --show | grep -q /swapfile; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

sudo dnf install -y nodejs22 nodejs22-npm nginx amazon-cloudwatch-agent python3-pip cronie
sudo alternatives --set node /usr/bin/node-22 2>/dev/null || true
sudo npm install -g pm2
# Cap PM2 logs (10 MB per file, 7 rotated files each) so they can't fill the disk.
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
sudo python3 -m pip install --quiet certbot certbot-nginx

sudo mkdir -p /opt/loadmitra && sudo chown ec2-user:ec2-user /opt/loadmitra
sudo systemctl enable --now nginx

# Restart the apps after a reboot.
pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -1 | sudo bash

# Renew TLS certificates twice a day (certbot only renews when close to expiry).
sudo systemctl enable --now crond
echo "0 0,12 * * * root /usr/local/bin/certbot renew --quiet --deploy-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot >/dev/null

echo "✔ Setup done. Next: create /opt/loadmitra/server/.env, then run deploy.sh from your machine."
