#!/bin/bash

# Add MongoDB Atlas to Railway
# This script adds the PROD_MONGO_URI environment variable

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              Add MongoDB Atlas to Railway                            ║"
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

# MongoDB connection string
MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Adding MongoDB Environment Variable"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Variable: PROD_MONGO_URI"
echo "Value: mongodb+srv://rishab1:***@ships.gwsbr.mongodb.net/..."
echo ""

# Add the variable
railway variables set PROD_MONGO_URI="$MONGO_URI"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ MongoDB environment variable added successfully!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Next Steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Railway will automatically redeploy (wait 30-60 seconds)"
    echo "2. Check logs: railway logs --follow"
    echo "3. Refresh your frontend"
    echo "4. MongoDB Atlas should now appear in the instances dropdown!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "❌ Failed to add environment variable"
    echo ""
    echo "Please add it manually in Railway Dashboard:"
    echo "1. Go to Railway Dashboard"
    echo "2. Click your backend service"
    echo "3. Go to Variables tab"
    echo "4. Add: PROD_MONGO_URI=$MONGO_URI"
    echo ""
fi
