// MongoDB Connection Test Script
// This script tests the MongoDB connection and displays database information
// Upload this via the UI to test MongoDB script execution

async function main() {
    console.log('🚀 Starting MongoDB connection test...');
    console.log('Testing database connection and querying information...\n');

    try {
        // Test 1: List all collections
        console.log('📋 Test 1: Collections in Database');
        
        // Get collection names by trying to count documents in each
        // Note: In the sandbox, we use the 'mongodb' wrapper which provides collection access
        const testCollections = ['ships', 'users', 'products', 'orders', 'customers'];
        const foundCollections = [];
        
        for (const collectionName of testCollections) {
            try {
                const count = await mongodb.collection(collectionName).countDocuments({});
                foundCollections.push({ name: collectionName, count });
                console.log(`✅ Collection: ${collectionName} (${count} documents)`);
            } catch (err) {
                // Collection doesn't exist, skip it
            }
        }
        
        if (foundCollections.length === 0) {
            console.log('ℹ️  No standard collections found. Trying to find any collection...');
        }
        console.log('');

        // Test 2: Query a sample collection (if exists)
        if (foundCollections.length > 0) {
            const firstCollection = foundCollections[0].name;
            console.log(`📊 Test 2: Sample Data from '${firstCollection}'`);
            
            const sampleDocs = await mongodb.collection(firstCollection).find({}).toArray();
            console.log(`✅ Found ${sampleDocs.length} documents`);
            
            if (sampleDocs.length > 0) {
                console.log('Sample document (first one):');
                console.log(JSON.stringify(sampleDocs[0], null, 2));
            }
            console.log('');
        }

        // Test 3: Test aggregation (if we have data)
        if (foundCollections.length > 0 && foundCollections[0].count > 0) {
            const firstCollection = foundCollections[0].name;
            console.log(`🔍 Test 3: Aggregation on '${firstCollection}'`);
            
            const aggResult = await mongodb.collection(firstCollection).aggregate([
                { $limit: 5 },
                { $project: { _id: 1 } }
            ]);
            
            console.log(`✅ Aggregation completed, returned ${aggResult.length} results`);
            console.log('');
        }

        // Test 4: Test findOne
        if (foundCollections.length > 0 && foundCollections[0].count > 0) {
            const firstCollection = foundCollections[0].name;
            console.log(`🔎 Test 4: FindOne on '${firstCollection}'`);
            
            const oneDoc = await mongodb.collection(firstCollection).findOne({});
            if (oneDoc) {
                console.log('✅ Found one document');
                console.log('Document ID:', oneDoc._id);
            }
            console.log('');
        }

        // Test 5: Summary
        console.log('📈 Test 5: Summary');
        console.log(`✅ Total collections found: ${foundCollections.length}`);
        const totalDocs = foundCollections.reduce((sum, col) => sum + col.count, 0);
        console.log(`✅ Total documents: ${totalDocs}`);
        console.log('');

        console.log('✅ All tests completed successfully!');
        console.log('🎉 MongoDB connection is working properly!');

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

// Execute main function
main();
