#!/bin/bash

# Target Database Seeder Helper
# Usage: ./scripts/seed_target.sh <TARGET_DB_CONNECTION_STRING>

if [ -z "$1" ]; then
  echo "Error: Connection string required."
  echo "Usage: ./scripts/seed_target.sh 'postgresql://user:pass@host:port/db'"
  exit 1
fi

echo "🌱 Seeding Target Database..."
echo "Target: $1"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "Error: 'psql' command not found."
    echo "Please install PostgreSQL client tools or run the SQL manually."
    exit 1
fi

# Run the SQL script
psql "$1" -f scripts/seed_target_db.sql

if [ $? -eq 0 ]; then
    echo "✅ Target Database Seeding Complete!"
else
    echo "❌ Seeding failed."
    exit 1
fi
