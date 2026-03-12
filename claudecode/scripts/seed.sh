#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run db:seed -w packages/backend
