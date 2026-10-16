#!/bin/sh
# Sandbox preview only. Do not start the hub app; that can reach production.
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi
cd /workspace || exit 1
npm run dev >/tmp/kilo-sandbox-dev.log 2>&1 &
exit 0
