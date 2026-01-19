// Test MongoDB Script Upload
// Upload this via the UI to test if the fix works

const { MongoClient } = require('mongodb');

async function main() {
    console.log('🚀 Starting MongoDB connection test...');
    console.log('Connection string length:', process.env.CONNECTION_STRING?.length || 0);
    console.log('Database name:', process.env.DATABASE_NAME);
    
    try {
        const client = new MongoClient(process.env.CONNECTION_STRING);
        
        console.log('Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Successfully connected to MongoDB!');
        
        const db = client.db(process.env.DATABASE_NAME);
        console.log('✅ Database selected:', process.env.DATABASE_NAME);
        
        // List collections
        const collections = await db.listCollections().toArray();
        console.log('✅ Collections found:', collections.length);
        
        if (collections.length > 0) {
            console.log('\nCollection names:');
            collections.forEach((col, index) => {
                console.log(`  ${index + 1}. ${col.name}`);
            });
        } else {
            console.log('No collections found in this database');
        }
        
        // Get database stats
        const stats = await db.stats();
        console.log('\nDatabase stats:');
        console.log('  - Collections:', stats.collections);
        console.log('  - Data size:', Math.round(stats.dataSize / 1024), 'KB');
        console.log('  - Storage size:', Math.round(stats.storageSize / 1024), 'KB');
        
        await client.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error occurred:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        throw error;
    }
}

main().catch(err => {
    console.error('\n❌ Test failed!');
    process.exit(1);
});
