#!/usr/bin/env bash
# Build a release bundle on your machine (a t3.micro has too little RAM to build).
#
#   EC2_IP=13.233.10.20 ./deploy/aws-ec2/build.sh
#
# Hostnames default to free sslip.io names that resolve to EC2_IP. Override with
# API_HOST / SHIPPER_HOST / CAPTAIN_HOST if you own a domain.
set -euo pipefail

: "${EC2_IP:?Set EC2_IP to the Elastic IP of the instance}"
DASHED="${EC2_IP//./-}"
API_HOST="${API_HOST:-api.$DASHED.sslip.io}"
SHIPPER_HOST="${SHIPPER_HOST:-ship.$DASHED.sslip.io}"
CAPTAIN_HOST="${CAPTAIN_HOST:-captain.$DASHED.sslip.io}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deploy/aws-ec2/release"
rm -rf "$OUT" && mkdir -p "$OUT/loadmitra"

echo "→ API      https://$API_HOST"
echo "→ Shipper  https://$SHIPPER_HOST"
echo "→ Captain  https://$CAPTAIN_HOST"

# The portals bake these public URLs in at build time.
export NITRO_PRESET=node-server
export VITE_API_URL="https://$API_HOST"
export VITE_SHIPPER_PORTAL_URL="https://$SHIPPER_HOST"
export VITE_CAPTAIN_PORTAL_URL="https://$CAPTAIN_HOST"

npm --prefix "$ROOT/server" run build
npm --prefix "$ROOT/shipper/frontend" run build
npm --prefix "$ROOT/captain/frontend" run build

mkdir -p "$OUT/loadmitra/server" "$OUT/loadmitra/shipper" "$OUT/loadmitra/captain"
cp -r "$ROOT/server/dist" "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$OUT/loadmitra/server/"
# Nitro bundles the portals' dependencies into .output, so no npm install is needed for them.
cp -r "$ROOT/shipper/frontend/.output" "$OUT/loadmitra/shipper/"
cp -r "$ROOT/captain/frontend/.output" "$OUT/loadmitra/captain/"
cp "$ROOT/deploy/aws-ec2/ecosystem.config.cjs" "$OUT/loadmitra/"
sed -e "s/__API_HOST__/$API_HOST/g" -e "s/__SHIPPER_HOST__/$SHIPPER_HOST/g" -e "s/__CAPTAIN_HOST__/$CAPTAIN_HOST/g" \
  "$ROOT/deploy/aws-ec2/nginx.conf" > "$OUT/loadmitra/loadmitra.nginx.conf"
cp "$ROOT/deploy/aws-ec2/cloudwatch-agent.json" "$OUT/loadmitra/"
printf 'API_HOST=%s\nSHIPPER_HOST=%s\nCAPTAIN_HOST=%s\n' "$API_HOST" "$SHIPPER_HOST" "$CAPTAIN_HOST" > "$OUT/loadmitra/hosts.env"

tar -czf "$OUT/loadmitra-release.tar.gz" -C "$OUT" loadmitra
echo "✔ $OUT/loadmitra-release.tar.gz"
