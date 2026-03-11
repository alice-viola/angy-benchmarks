#!/usr/bin/env bash
set -euo pipefail

echo "Seeding database..."
npm run db:seed --workspace=packages/backend
echo "Database seeded successfully"
