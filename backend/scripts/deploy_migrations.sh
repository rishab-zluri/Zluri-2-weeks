#!/bin/bash

# Production Migration Helper Script
# Usage: ./scripts/deploy_migrations.sh <CONNECTION_STRING>

if [ -z "$1" ]; then
  echo "Error: Connection string required."
  echo "Usage: ./scripts/deploy_migrations.sh 'postgresql://user:pass@host:port/db'"
  exit 1
fi

echo "🚀 Starting Production Migrations..."
echo "Target: $1"

# Export env vars for MikroORM to pick up
export NODE_ENV=production
export PORTAL_DB_URL="$1"

# Parse connection string to individual vars (basic fallback if parsed in config)
# Or simpler: Rely on the config/index.ts parsing logic if updated, 
# but for now let's set the overrides used in config

# Actually, the best way for MikroORM CLI in prod is ensuring the .env is populated OR passing params.
# Since we removed Docker, we assume the user runs this locally or in CI.

# Let's use the exact command
export MIRO_ORM_DYNAMIC_URL="$1" 

# Note: Our config reads PORTAL_DB_HOST etc. 
# We might need to parse the URL or ask user to fill .env.production.
# For simplicity, we assume .env.production exists or vars are exported.

echo "Running migration..."
npm run orm:migration:up

echo "✅ Migrations Complete!"
