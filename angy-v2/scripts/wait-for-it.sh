#!/usr/bin/env bash
# wait-for-it.sh — Wait for a TCP host:port to become available
set -euo pipefail

HOST=""
PORT=""
TIMEOUT=30
QUIET=0

usage() {
  echo "Usage: $0 host:port [-t timeout] [-q] [-- command args]"
  exit 1
}

wait_for() {
  local start_ts=$(date +%s)
  while :; do
    (echo > /dev/tcp/$HOST/$PORT) >/dev/null 2>&1 && break
    local now_ts=$(date +%s)
    local elapsed=$((now_ts - start_ts))
    if [ $elapsed -ge $TIMEOUT ]; then
      echo "Timeout after ${TIMEOUT}s waiting for ${HOST}:${PORT}"
      exit 1
    fi
    sleep 1
  done
  if [ $QUIET -eq 0 ]; then
    echo "${HOST}:${PORT} is available after ${elapsed}s"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    *:*)
      HOST=$(echo "$1" | cut -d: -f1)
      PORT=$(echo "$1" | cut -d: -f2)
      shift
      ;;
    -t)
      TIMEOUT="$2"
      shift 2
      ;;
    -q)
      QUIET=1
      shift
      ;;
    --)
      shift
      break
      ;;
    *)
      usage
      ;;
  esac
done

if [ -z "$HOST" ] || [ -z "$PORT" ]; then
  usage
fi

wait_for

if [ $# -gt 0 ]; then
  exec "$@"
fi
