// MongoDB Data Analysis Script
// Analyzes collections and data distribution
// Safe read-only operations for data exploration

async function main() {
    console.log('📊 MongoDB Data Analysis Report');
    console.log('=' .repeat(50));
    console.log('');

    try {
        // List of common collection names to check
        const commonCollections = [
            'users', 'customers', 'orders', 'products', 'items',
            'ships', 'vessels', 'transactions', 'logs', 'events',
            'sessions', 'accounts', 'profiles', 'posts', 'comments'
        ];

        const foundCollections = [];

        // 1. Collection Discovery
        console.log('🔍 COLLECTION DISCOVERY');
        console.log('-'.repeat(50));
        console.log('Scanning for collections...\n');

        for (const collectionName of commonCollections) {
            try {
                const count = await mongodb.collection(collectionName).countDocuments({});
                if (count >= 0) {
                    foundCollections.push({ name: collectionName, count });
                    console.log(`✅ Found: ${collectionName} (${count} documents)`);
                }
            } catch (err) {
                // Collection doesn't exist, skip silently
            }
        }

        if (foundCollections.length === 0) {
            console.log('⚠️  No standard collections found.');
            console.log('The database might be empty or use custom collection names.');
            console.log('');
            return;
        }

        console.log(`\n📋 Total collections found: ${foundCollections.length}`);
        console.log('');

        // 2. Collection Size Analysis
        console.log('📊 COLLECTION SIZE ANALYSIS');
        console.log('-'.repeat(50));
        
        const totalDocs = foundCollections.reduce((sum, col) => sum + col.count, 0);
        console.log(`Total documents across all collections: ${totalDocs}\n`);

        foundCollections
            .sort((a, b) => b.count - a.count)
            .forEach((col, index) => {
                const percentage = totalDocs > 0 ? ((col.count / totalDocs) * 100).toFixed(2) : 0;
                console.log(`${index + 1}. ${col.name}`);
                console.log(`   Documents: ${col.count} (${percentage}%)`);
            });
        console.log('');

        // 3. Sample Data Analysis (first collection with data)
        const collectionWithData = foundCollections.find(col => col.count > 0);
        
        if (collectionWithData) {
            console.log(`📄 SAMPLE DATA ANALYSIS: ${collectionWithData.name}`);
            console.log('-'.repeat(50));
            
            // Get sample documents
            const samples = await mongodb.collection(collectionWithData.name)
                .find({})
                .toArray();
            
            if (samples.length > 0) {
                console.log(`Retrieved ${samples.length} sample documents\n`);
                
                // Analyze document structure
                const firstDoc = samples[0];
                const fields = Object.keys(firstDoc);
                
                console.log('Document Structure:');
                fields.forEach(field => {
                    const value = firstDoc[field];
                    const type = Array.isArray(value) ? 'array' : typeof value;
                    console.log(`  - ${field}: ${type}`);
                });
                console.log('');

                // Show first document
                console.log('Sample Document (first one):');
                console.log(JSON.stringify(firstDoc, null, 2));
                console.log('');
            }
        }

        // 4. Aggregation Analysis (if we have data)
        if (collectionWithData && collectionWithData.count > 0) {
            console.log(`🔍 AGGREGATION ANALYSIS: ${collectionWithData.name}`);
            console.log('-'.repeat(50));
            
            try {
                // Get field statistics
                const pipeline = [
                    { $limit: 100 },
                    { $project: { _id: 1 } }
                ];
                
                const aggResult = await mongodb.collection(collectionWithData.name)
                    .aggregate(pipeline);
                
                console.log(`✅ Aggregation successful`);
                console.log(`   Processed: ${aggResult.length} documents`);
                console.log('');
            } catch (err) {
                console.log(`⚠️  Aggregation failed: ${err.message}`);
                console.log('');
            }
        }

        // 5. Data Distribution Analysis
        console.log('📈 DATA DISTRIBUTION');
        console.log('-'.repeat(50));
        
        for (const col of foundCollections.slice(0, 3)) {
            if (col.count > 0) {
                console.log(`\n${col.name}:`);
                
                try {
                    // Try to get some basic stats
                    const sample = await mongodb.collection(col.name).findOne({});
                    
                    if (sample) {
                        const fieldCount = Object.keys(sample).length;
                        console.log(`  Fields per document: ~${fieldCount}`);
                        console.log(`  Has _id field: ${sample._id ? 'Yes' : 'No'}`);
                        
                        // Check for common timestamp fields
                        const hasCreatedAt = 'createdAt' in sample || 'created_at' in sample;
                        const hasUpdatedAt = 'updatedAt' in sample || 'updated_at' in sample;
                        
                        if (hasCreatedAt) console.log(`  Has creation timestamp: Yes`);
                        if (hasUpdatedAt) console.log(`  Has update timestamp: Yes`);
                    }
                } catch (err) {
                    console.log(`  Unable to analyze: ${err.message}`);
                }
            }
        }
        console.log('');

        // 6. Query Performance Test
        console.log('⚡ QUERY PERFORMANCE TEST');
        console.log('-'.repeat(50));
        
        if (collectionWithData && collectionWithData.count > 0) {
            const startTime = Date.now();
            
            await mongodb.collection(collectionWithData.name)
                .find({})
                .toArray();
            
            const duration = Date.now() - startTime;
            
            console.log(`Collection: ${collectionWithData.name}`);
            console.log(`Query: find({}).limit(1000)`);
            console.log(`Duration: ${duration}ms`);
            console.log(`Performance: ${duration < 100 ? '🚀 Excellent' : duration < 500 ? '✅ Good' : '⚠️  Slow'}`);
        }
        console.log('');

        // Summary
        console.log('=' .repeat(50));
        console.log('✅ Analysis completed successfully!');
        console.log('📊 Report Summary:');
        console.log(`   - Collections analyzed: ${foundCollections.length}`);
        console.log(`   - Total documents: ${totalDocs}`);
        console.log(`   - Largest collection: ${foundCollections[0].name} (${foundCollections[0].count} docs)`);
        console.log('📅 Generated at:', new Date().toISOString());

    } catch (error) {
        console.error('❌ Analysis failed:');
        console.error('Error:', error.message);
        throw error;
    }
}

main();
