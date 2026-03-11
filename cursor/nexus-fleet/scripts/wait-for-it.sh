#!/usr/bin/env bash
set -euo pipefail

HOST="$1"
PORT="$2"
shift 2
TIMEOUT="${TIMEOUT:-30}"

echo "Waiting for $HOST:$PORT..."
for i in $(seq 1 $TIMEOUT); do
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo "$HOST:$PORT is available"
    exec "$@"
  fi
  sleep 1
done

echo "Timeout waiting for $HOST:$PORT"
exit 1
