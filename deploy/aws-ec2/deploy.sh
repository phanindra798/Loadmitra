#!/usr/bin/env bash
# Upload the release built by build.sh and (re)start everything.
#
#   EC2_IP=13.233.10.20 SSH_KEY=~/.ssh/loadmitra.pem ./deploy/aws-ec2/deploy.sh
#
# First deploy only: add CERTBOT_EMAIL=you@example.com (or CERTBOT_NO_EMAIL=1 to skip
# Let's Encrypt's expiry emails) to issue free HTTPS certificates.
set -euo pipefail

: "${EC2_IP:?Set EC2_IP}"
: "${SSH_KEY:?Set SSH_KEY to your .pem key path}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUNDLE="$ROOT/deploy/aws-ec2/release/loadmitra-release.tar.gz"
[ -f "$BUNDLE" ] || { echo "Run build.sh first"; exit 1; }
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$EC2_IP")

scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$BUNDLE" "ec2-user@$EC2_IP:/tmp/loadmitra-release.tar.gz"

"${SSH[@]}" CERTBOT_EMAIL="${CERTBOT_EMAIL:-}" CERTBOT_NO_EMAIL="${CERTBOT_NO_EMAIL:-}" bash -s <<'REMOTE'
set -euo pipefail
cd /tmp && rm -rf loadmitra && tar -xzf loadmitra-release.tar.gz
[ -f /opt/loadmitra/server/.env ] || { echo "Create /opt/loadmitra/server/.env first (see deploy/aws-ec2/README.md)"; exit 1; }

# Replace code, keep the server's .env.
cp /opt/loadmitra/server/.env /tmp/loadmitra.env
rm -rf /opt/loadmitra/server /opt/loadmitra/shipper /opt/loadmitra/captain
cp -r /tmp/loadmitra/server /tmp/loadmitra/shipper /tmp/loadmitra/captain /tmp/loadmitra/ecosystem.config.cjs /opt/loadmitra/
cp /tmp/loadmitra.env /opt/loadmitra/server/.env && chmod 600 /opt/loadmitra/server/.env
(cd /opt/loadmitra/server && npm ci --omit=dev --no-audit --no-fund)

pm2 startOrReload /opt/loadmitra/ecosystem.config.cjs --update-env && pm2 save

# nginx: install the site once; certbot then owns the file (it adds the HTTPS blocks).
source /tmp/loadmitra/hosts.env
if [ ! -f /etc/nginx/conf.d/loadmitra.conf ]; then
  sudo cp /tmp/loadmitra/loadmitra.nginx.conf /etc/nginx/conf.d/loadmitra.conf
  sudo nginx -t && sudo systemctl reload nginx
fi
if [ -n "$CERTBOT_EMAIL" ] || [ -n "$CERTBOT_NO_EMAIL" ]; then
  if [ -n "$CERTBOT_EMAIL" ]; then CONTACT=(-m "$CERTBOT_EMAIL"); else CONTACT=(--register-unsafely-without-email); fi
  sudo /usr/local/bin/certbot --nginx --non-interactive --agree-tos "${CONTACT[@]}" --redirect \
    -d "$API_HOST" -d "$SHIPPER_HOST" -d "$CAPTAIN_HOST"
fi

# CloudWatch agent (needs the instance IAM role described in the README).
sudo cp /tmp/loadmitra/cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/loadmitra.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/loadmitra.json -s >/dev/null

# /health answers 503 until MongoDB is connected; Atlas can take a few seconds.
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:4000/health && echo && break; sleep 2; done
curl -fsS http://127.0.0.1:4000/health >/dev/null || { echo "API is up but MongoDB is not connected: pm2 logs loadmitra-api"; exit 1; }
pm2 ls
echo "✔ https://$SHIPPER_HOST  https://$CAPTAIN_HOST  https://$API_HOST/health"
REMOTE
