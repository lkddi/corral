#!/usr/bin/env bash
# I1 smoke test: link -> nginx -> PHP-FPM -> HTTP response
#
# Runs entirely inside an isolated data dir on an unprivileged port, so it never
# touches a system nginx / Herd / Valet install.
#
# Requirements: a built CLI+core (npm run build), a PHP version installed in $CORRAL_DATA_DIR,
# and an nginx binary. Example:
#
#   CORRAL_NGINX_BIN=/opt/homebrew/bin/nginx ./scripts/smoke-i1.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CORRAL_DATA_DIR="${CORRAL_DATA_DIR:-/tmp/corral-smoke}"
export CORRAL_TLD="${CORRAL_TLD:-corral}"
export CORRAL_HTTP_PORT="${CORRAL_HTTP_PORT:-18080}"
CLI="node $ROOT/packages/cli/dist/corral.js"
APP="$CORRAL_DATA_DIR/app"
PASS=0
FAIL=0

check() { # name expected actual
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1"; PASS=$((PASS+1)); else echo "  FAIL  $1 (expected '$2', got '$3')"; FAIL=$((FAIL+1)); fi
}

echo "corral I1 smoke — data=$CORRAL_DATA_DIR port=$CORRAL_HTTP_PORT tld=$CORRAL_TLD"

mkdir -p "$APP"
cat > "$APP/index.php" <<'PHP'
<?php echo json_encode(['php' => PHP_VERSION, 'sapi' => PHP_SAPI]);
PHP

pkill -f "$CORRAL_DATA_DIR" 2>/dev/null || true
( node "$ROOT/packages/core/dist/daemon/index.js" > "$CORRAL_DATA_DIR.daemon.log" 2>&1 & )
sleep 1.2

echo "[1] link"
(cd "$APP" && $CLI link > /dev/null)
BODY="$(curl -sS --noproxy '*' --max-time 10 -H "Host: app.$CORRAL_TLD" "http://127.0.0.1:$CORRAL_HTTP_PORT/")"
check "php served through nginx+fpm" "yes" "$(echo "$BODY" | grep -c '"sapi":"fpm-fcgi"')"
check "php version reported"          "yes" "$(echo "$BODY" | grep -c '"php":"')"

echo "[2] unknown host isolation"
CODE="$(curl -sS --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: nope.$CORRAL_TLD" "http://127.0.0.1:$CORRAL_HTTP_PORT/")"
check "unknown host -> 404" "404" "$CODE"

echo "[3] stop / start site"
$CLI stop app > /dev/null
check "vhost removed on stop" "0" "$(ls "$CORRAL_DATA_DIR/nginx/sites" 2>/dev/null | wc -l | tr -d ' ')"
$CLI start app > /dev/null
check "vhost restored on start" "1" "$(ls "$CORRAL_DATA_DIR/nginx/sites" 2>/dev/null | wc -l | tr -d ' ')"

echo "[4] unlink twice"
$CLI unlink > /dev/null
CODE="$(cd "$APP" && $CLI unlink --json | python3 -c 'import sys,json; print(json.load(sys.stdin)["error"]["code"])')"
check "second unlink -> SITE_NOT_FOUND" "SITE_NOT_FOUND" "$CODE"

echo "[5] clean up"
$CLI stop > /dev/null 2>&1 || true
pkill -f "$CORRAL_DATA_DIR" 2>/dev/null || true

echo "result: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
