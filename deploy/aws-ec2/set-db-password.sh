#!/usr/bin/env bash
# Puts the Atlas password into the API settings without echoing it.
set -euo pipefail
read -rsp "Atlas password for loadmitra-api: " P; echo
[ -n "$P" ] || { echo "Empty password, nothing changed"; exit 1; }
E=$(printf %s "$P" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=\"\"))")
F=/opt/loadmitra/server/.env
grep -q "^MONGODB_URI=mongodb+srv://loadmitra-api:" "$F"
sed -i -E "s|^(MONGODB_URI=mongodb\+srv://loadmitra-api:)[^@]*@|\1${E}@|" "$F"
echo "Saved. You can close this window."
