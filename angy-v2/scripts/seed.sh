#!/usr/bin/env bash
# Run the database seed script.
# Usage: bash scripts/seed.sh
#
# Requires DATABASE_URL to be set (or .env file at project root).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Ensure .env exists or export DATABASE_URL."
  exit 1
fi

echo "Running database seed..."
npx tsx packages/backend/src/db/seed.ts
