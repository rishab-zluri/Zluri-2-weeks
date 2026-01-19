#!/bin/bash

# Railway Setup Script
# This script will guide you through setting up your Railway database

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              Railway Database Setup - Interactive Script             ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    brew install railway
    echo "✅ Railway CLI installed!"
else
    echo "✅ Railway CLI found (version $(railway --version))"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Login to Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will open your browser. Please authorize the Railway CLI."
echo ""
read -p "Press Enter to continue..."

railway login

if [ $? -eq 0 ]; then
    echo "✅ Successfully logged in to Railway!"
else
    echo "❌ Login failed. Please try again."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Link to Your Project"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Select your backend project from the list..."
echo ""

cd backend
railway link

if [ $? -eq 0 ]; then
    echo "✅ Successfully linked to Railway project!"
else
    echo "❌ Failed to link project. Please try again."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Build the Project"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Run Database Migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will create all database tables..."
echo ""

railway run npm run orm:migration:up

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
else
    echo "❌ Migrations failed. Trying alternative approach..."
    echo ""
    echo "Attempting to create schema directly..."
    railway run npm run orm:schema:fresh
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Verify Tables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

railway run psql \$DATABASE_URL -c "\\dt" 2>/dev/null || echo "⚠️  Could not verify tables (this is okay)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Create Admin User"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Creating admin user..."
echo ""

railway run node -e "
const { MikroORM } = require('@mikro-orm/core');
const config = require('./dist/mikro-orm.config').default;
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();
    
    const User = require('./dist/entities/User').User;
    
    // Check if admin already exists
    const existing = await em.findOne(User, { email: 'admin@yourdomain.com' });
    
    if (existing) {
      console.log('⚠️  Admin user already exists');
      await orm.close();
      return;
    }
    
    const admin = em.create(User, {
      email: 'admin@yourdomain.com',
      passwordHash: await bcrypt.hash('Admin123!', 12),
      name: 'Admin User',
      role: 'admin',
      isActive: true
    });
    
    await em.persistAndFlush(admin);
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('Login Credentials:');
    console.log('  Email: admin@yourdomain.com');
    console.log('  Password: Admin123!');
    console.log('');
    console.log('⚠️  Please change this password after first login!');
    
    await orm.close();
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
})();
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7: Verify Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

railway run psql \$DATABASE_URL -c "SELECT email, role, is_active FROM users;" 2>/dev/null || echo "⚠️  Could not verify users (this is okay)"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                          ✅ SETUP COMPLETE!                          ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your Railway database is now set up with:"
echo "  ✅ All database tables created"
echo "  ✅ Admin user created"
echo ""
echo "Next Steps:"
echo "  1. Visit your frontend: https://your-app.vercel.app"
echo "  2. Login with:"
echo "     Email: admin@yourdomain.com"
echo "     Password: Admin123!"
echo "  3. Change your password after first login"
echo ""
echo "View logs: railway logs --follow"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
