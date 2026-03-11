#!/usr/bin/env bash
set -euo pipefail

HOST="$1"
PORT="$2"
TIMEOUT="${3:-30}"

echo "Waiting for $HOST:$PORT (timeout: ${TIMEOUT}s)..."

start_time=$(date +%s)
while ! nc -z "$HOST" "$PORT" 2>/dev/null; do
  elapsed=$(( $(date +%s) - start_time ))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "Timeout waiting for $HOST:$PORT after ${TIMEOUT}s"
    exit 1
  fi
  sleep 1
done

echo "$HOST:$PORT is available"
