// Test MongoDB Atlas connection
const { MongoClient } = require('mongodb');

// Test connection string with rishab3 credentials
const uri = 'mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/?appName=ships';

console.log('Testing MongoDB connection...');
console.log('URI (safe):', uri.replace(/:[^:@]+@/, ':****@'));

async function testConnection() {
    const client = new MongoClient(uri);
    
    try {
        console.log('\n1. Connecting to MongoDB Atlas...');
        await client.connect();
        console.log('✅ Connected successfully!');
        
        console.log('\n2. Listing databases...');
        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();
        console.log(`✅ Found ${dbs.databases.length} databases:`);
        dbs.databases.forEach(db => {
            console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });
        
        console.log('\n✅ MongoDB connection is working correctly!');
        console.log('\nThe connection string is valid. The issue must be with Railway environment variable.');
        
    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error('Error:', error.message);
        
        if (error.message.includes('bad auth')) {
            console.error('\n🔍 Authentication failed. Possible reasons:');
            console.error('   1. Username is wrong (should be: rishab1)');
            console.error('   2. Password is wrong (should be: 123@Acharjee)');
            console.error('   3. Password not URL-encoded (@ should be %40)');
            console.error('   4. User doesn\'t have access to the database');
            console.error('   5. IP whitelist blocking the connection');
        }
        
        if (error.message.includes('ENOTFOUND')) {
            console.error('\n🔍 Host not found. Check:');
            console.error('   1. Cluster URL is correct: ships.gwsbr.mongodb.net');
            console.error('   2. Internet connection is working');
        }
        
    } finally {
        await client.close();
        console.log('\nConnection closed.');
    }
}

testConnection().catch(console.error);
