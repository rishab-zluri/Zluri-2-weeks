#!/bin/bash

# Add Both Database Instances to Railway
# This adds PostgreSQL and MongoDB environment variables

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║         Add Both Database Instances to Railway                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   brew install railway"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Connection strings
POSTGRES_URL="postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require"
MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Adding Database Environment Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add PostgreSQL
echo "1️⃣  Adding PostgreSQL (Zluri Query Portal)..."
railway variables set PROD_TARGET_URL="$POSTGRES_URL"

if [ $? -eq 0 ]; then
    echo "   ✅ PostgreSQL variable added"
else
    echo "   ❌ Failed to add PostgreSQL variable"
    exit 1
fi

echo ""

# Add MongoDB
echo "2️⃣  Adding MongoDB (Ships Cluster)..."
railway variables set PROD_MONGO_URI="$MONGO_URI"

if [ $? -eq 0 ]; then
    echo "   ✅ MongoDB variable added"
else
    echo "   ❌ Failed to add MongoDB variable"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Both database instances configured!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next Steps:"
echo "1. Railway will automatically redeploy (wait 30-60 seconds)"
echo "2. Check logs: railway logs --follow"
echo "3. Refresh your frontend"
echo "4. Both instances should appear in the dropdown!"
echo ""
echo "Expected in Instance Dropdown:"
echo "  ✅ Zluri Query Portal (PostgreSQL)"
echo "  ✅ MongoDB Atlas - Ships Cluster (MongoDB)"
echo ""
echo "When you select each instance, you'll see their databases!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
