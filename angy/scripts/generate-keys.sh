#!/usr/bin/env bash
set -euo pipefail

KEYS_DIR="${1:-./keys}"
mkdir -p "$KEYS_DIR"

echo "Generating RS256 2048-bit key pair..."
openssl genrsa -out "$KEYS_DIR/private.pem" 2048
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

echo "Keys generated in $KEYS_DIR/"
