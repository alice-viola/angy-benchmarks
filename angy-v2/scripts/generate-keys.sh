#!/usr/bin/env bash
set -euo pipefail

KEYS_DIR="$(cd "$(dirname "$0")/.." && pwd)/keys"
mkdir -p "$KEYS_DIR"

echo "Generating RS256 2048-bit key pair..."
openssl genrsa -out "$KEYS_DIR/private.pem" 2048
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

echo ""
echo "Keys generated:"
echo "  Private: $KEYS_DIR/private.pem"
echo "  Public:  $KEYS_DIR/public.pem"
echo ""
echo "To use with Docker Compose, set environment variables:"
echo "  export JWT_PRIVATE_KEY=\$(cat $KEYS_DIR/private.pem)"
echo "  export JWT_PUBLIC_KEY=\$(cat $KEYS_DIR/public.pem)"
