/**
 * MongoDB Read-Only Script Example
 * 
 * This script demonstrates safe read operations on a MongoDB database.
 * Perfect for generating reports or analyzing collections.
 * 
 * USAGE:
 * - Upload this as a script submission
 * - Select a MongoDB instance
 * - Select target database
 * 
 * WHAT IT DOES:
 * 1. Lists all collections
 * 2. Counts documents in each collection
 * 3. Shows sample documents
 * 4. Analyzes data structure
 */

const { MongoClient } = require('mongodb');

async function main() {
    // Connection is automatically provided by the portal
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        console.log('🔍 Starting MongoDB Analysis...\n');
        
        await client.connect();
        const db = client.db();

        // 1. List all collections
        console.log('📚 Collections in database:');
        const collections = await db.listCollections().toArray();
        console.log(`   Found ${collections.length} collections\n`);

        // 2. Analyze each collection
        for (const collInfo of collections) {
            const collName = collInfo.name;
            const collection = db.collection(collName);

            console.log(`📊 Collection: ${collName}`);
            console.log('   ' + '='.repeat(50));

            // Count documents
            const count = await collection.countDocuments();
            console.log(`   Total documents: ${count}`);

            if (count > 0) {
                // Get sample document
                const sample = await collection.findOne();
                console.log(`   Sample document keys: ${Object.keys(sample).join(', ')}`);

                // Get date range if created_at exists
                if (sample.created_at || sample.createdAt || sample.timestamp) {
                    const dateField = sample.created_at ? 'created_at' 
                                    : sample.createdAt ? 'createdAt' 
                                    : 'timestamp';
                    
                    const oldest = await collection.find().sort({ [dateField]: 1 }).limit(1).toArray();
                    const newest = await collection.find().sort({ [dateField]: -1 }).limit(1).toArray();
                    
                    console.log(`   Date range: ${oldest[0][dateField]} to ${newest[0][dateField]}`);
                }

                // Show first 3 documents
                console.log(`   First 3 documents:`);
                const samples = await collection.find().limit(3).toArray();
                samples.forEach((doc, idx) => {
                    console.log(`   ${idx + 1}. ${JSON.stringify(doc, null, 2).split('\n').join('\n      ')}`);
                });
            } else {
                console.log('   (empty collection)');
            }

            console.log('');
        }

        // 3. Database statistics
        console.log('📈 Database Statistics:');
        const stats = await db.stats();
        console.log(`   Total collections: ${stats.collections}`);
        console.log(`   Total documents: ${stats.objects}`);
        console.log(`   Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Indexes: ${stats.indexes}`);
        console.log('');

        console.log('✅ Analysis Complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.close();
    }
}

// Execute
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
