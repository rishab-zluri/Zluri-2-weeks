#!/bin/bash
# Quick fix for MongoDB schema error
# Run this from your project root directory

echo "🔧 Fixing database schema for MongoDB support..."
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm i -g @railway/cli"
    echo ""
    echo "Or run the SQL manually in Railway dashboard:"
    echo "   See RUN_THIS_SQL_NOW.md for instructions"
    exit 1
fi

# Check if linked to Railway project
if ! railway status &> /dev/null; then
    echo "❌ Not linked to Railway project. Run:"
    echo "   railway link"
    exit 1
fi

# Run the migration
echo "Running schema migration..."
railway run psql \$DATABASE_URL -f backend/fix-host-port-nullable.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Schema fix applied successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Set PROD_MONGO_URI in Railway Variables"
    echo "2. Commit and push nixpacks.toml"
    echo "3. Wait for Railway to redeploy"
    echo ""
    echo "See MONGODB_COMPLETE_FIX.md for details"
else
    echo ""
    echo "❌ Schema fix failed. Try running manually:"
    echo "   See RUN_THIS_SQL_NOW.md for instructions"
    exit 1
fi
