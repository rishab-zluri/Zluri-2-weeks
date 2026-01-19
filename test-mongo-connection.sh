#!/bin/bash

# Test MongoDB Connection String
# This tests if the MongoDB URI is correctly formatted

echo "🔍 Testing MongoDB Connection..."
echo ""

# The correct connection string
MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"

echo "Connection string:"
echo "$MONGO_URI"
echo ""

# Test with Node.js
node << 'EOF'
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

async function test() {
    console.log('Attempting to connect...');
    
    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
    });
    
    try {
        await client.connect();
        console.log('✅ Connection successful!');
        
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();
        
        console.log('\n📊 Databases found:', dbs.databases.length);
        console.log('\nDatabase names:');
        dbs.databases.forEach((db, i) => {
            console.log(`  ${i + 1}. ${db.name} (${Math.round(db.sizeOnDisk / 1024)} KB)`);
        });
        
        await client.close();
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Connection failed!');
        console.error('Error:', error.message);
        if (error.code) {
            console.error('Code:', error.code);
        }
        process.exit(1);
    }
}

test();
EOF
