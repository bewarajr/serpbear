#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/kiwkiw/projects/serpbear"
TUNNEL_NAME="serpbear-bewara-20261013"
HOSTNAME="serpbear.bewara.xyz"
CREDENTIALS_FILE="$ROOT/.serpbear-tunnel-credentials.json"
STATE_FILE="$ROOT/.serpbear-tunnel-created"
DNS_MARKER="$ROOT/.serpbear-cloudflare-dns-routed"
CONFIG_FILE="$ROOT/.serpbear-cloudflared.yml"

cd "$ROOT"

if [[ "$(id -un)" != "kiwkiw" ]]; then
  echo "Run this script as kiwkiw without sudo; it invokes sudo only for its systemd unit." >&2
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed." >&2
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing $ROOT/.env; refusing to change the application configuration." >&2
  exit 1
fi

if [[ -e "$CREDENTIALS_FILE" || -e "$STATE_FILE" ]]; then
  if [[ ! -s "$CREDENTIALS_FILE" || ! -s "$STATE_FILE" ]]; then
    echo "Incomplete tunnel state found; inspect the project files before continuing." >&2
    exit 1
  fi
  TUNNEL_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["TunnelID"])' "$CREDENTIALS_FILE")"
  read -r SAVED_NAME SAVED_ID < "$STATE_FILE"
  if [[ "$SAVED_NAME" != "$TUNNEL_NAME" || "$SAVED_ID" != "$TUNNEL_ID" ]]; then
    echo "Tunnel state does not match this SerpBear setup; refusing to reuse it." >&2
    exit 1
  fi
else
  umask 077
  cloudflared tunnel create --credentials-file "$CREDENTIALS_FILE" "$TUNNEL_NAME"
  TUNNEL_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["TunnelID"])' "$CREDENTIALS_FILE")"
  printf '%s %s\n' "$TUNNEL_NAME" "$TUNNEL_ID" > "$STATE_FILE"
  chmod 600 "$CREDENTIALS_FILE" "$STATE_FILE"
fi

cat > "$CONFIG_FILE" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CREDENTIALS_FILE
ingress:
  - hostname: $HOSTNAME
    service: http://127.0.0.1:3180
  - service: http_status:404
EOF
chmod 600 "$CONFIG_FILE"

if [[ ! -e "$DNS_MARKER" ]]; then
  cloudflared tunnel route dns "$TUNNEL_ID" "$HOSTNAME"
  : > "$DNS_MARKER"
  chmod 600 "$DNS_MARKER"
fi

python3 - "$ROOT/.env" "https://$HOSTNAME" <<'PY'
import os
import re
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
public_url = sys.argv[2]
contents = env_path.read_text()
replacement = f"NEXT_PUBLIC_APP_URL={public_url}"
if re.search(r"(?m)^NEXT_PUBLIC_APP_URL=.*$", contents):
    contents = re.sub(r"(?m)^NEXT_PUBLIC_APP_URL=.*$", replacement, contents)
else:
    contents = contents.rstrip("\n") + "\n" + replacement + "\n"
env_path.write_text(contents)
os.chmod(env_path, 0o600)
PY

docker compose -f "$ROOT/compose.official.yml" up -d app
sudo install -m 0644 "$ROOT/serpbear-cloudflared.service" /etc/systemd/system/serpbear-cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now serpbear-cloudflared.service

echo "SerpBear tunnel configured for https://$HOSTNAME"
echo "Check status with: sudo systemctl status serpbear-cloudflared.service"
echo "Verify with: curl -I https://$HOSTNAME/login/"
