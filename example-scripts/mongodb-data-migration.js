/**
 * MongoDB Data Migration Script
 * 
 * This script demonstrates data transformation and migration.
 * Use with caution - this modifies data!
 * 
 * USAGE:
 * - Upload this as a script submission
 * - Select a MongoDB instance
 * - Select target database
 * - Get manager approval before execution
 * 
 * WHAT IT DOES:
 * 1. Finds documents matching criteria
 * 2. Transforms/updates them
 * 3. Provides detailed report
 * 
 * EXAMPLE USE CASE:
 * - Add new field to existing documents
 * - Rename fields
 * - Update status values
 * - Migrate data structure
 */

const { MongoClient } = require('mongodb');

// Configuration
const DRY_RUN = false; // Set to true to preview without making changes
const COLLECTION_NAME = 'ships'; // Target collection
const BATCH_SIZE = 100; // Process in batches

async function main() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        console.log('🔄 Starting MongoDB Data Migration...');
        console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify data)'}`);
        console.log(`   Collection: ${COLLECTION_NAME}`);
        console.log(`   Batch size: ${BATCH_SIZE}\n`);

        await client.connect();
        const db = client.db();
        const collection = db.collection(COLLECTION_NAME);

        // 1. Find documents that need migration
        console.log('🔍 Step 1: Finding documents to migrate...');
        const query = {
            // Example: Find documents without a specific field
            status: { $exists: false }
        };

        const totalCount = await collection.countDocuments(query);
        console.log(`   Found ${totalCount} documents to migrate\n`);

        if (totalCount === 0) {
            console.log('✅ No documents need migration!');
            return;
        }

        // 2. Preview changes
        console.log('👀 Step 2: Preview of changes...');
        const samples = await collection.find(query).limit(3).toArray();
        console.log('   Before:');
        samples.forEach((doc, idx) => {
            console.log(`   ${idx + 1}. ${JSON.stringify(doc, null, 2).split('\n').join('\n      ')}`);
        });
        console.log('');

        if (DRY_RUN) {
            console.log('   After (preview):');
            samples.forEach((doc, idx) => {
                const updated = {
                    ...doc,
                    status: 'active', // Add default status
                    migrated_at: new Date(),
                    migration_version: 1
                };
                console.log(`   ${idx + 1}. ${JSON.stringify(updated, null, 2).split('\n').join('\n      ')}`);
            });
            console.log('');
        }

        // 3. Perform migration
        if (!DRY_RUN) {
            console.log('⚙️  Step 3: Migrating documents...');
            
            let processed = 0;
            let updated = 0;
            let errors = 0;

            const cursor = collection.find(query).batchSize(BATCH_SIZE);

            for await (const doc of cursor) {
                try {
                    const result = await collection.updateOne(
                        { _id: doc._id },
                        {
                            $set: {
                                status: 'active',
                                migrated_at: new Date(),
                                migration_version: 1
                            }
                        }
                    );

                    if (result.modifiedCount > 0) {
                        updated++;
                    }
                    processed++;

                    // Progress indicator
                    if (processed % BATCH_SIZE === 0) {
                        console.log(`   Progress: ${processed}/${totalCount} (${Math.round(processed/totalCount*100)}%)`);
                    }

                } catch (error) {
                    errors++;
                    console.error(`   Error updating document ${doc._id}:`, error.message);
                }
            }

            console.log(`   Final: ${processed}/${totalCount} processed\n`);

            // 4. Verify migration
            console.log('✅ Step 4: Verification...');
            const verifyCount = await collection.countDocuments({
                status: { $exists: true },
                migration_version: 1
            });
            console.log(`   Documents with new fields: ${verifyCount}`);
            console.log('');

            // Summary
            console.log('📊 Migration Summary:');
            console.log(`   Total found: ${totalCount}`);
            console.log(`   Processed: ${processed}`);
            console.log(`   Updated: ${updated}`);
            console.log(`   Errors: ${errors}`);
            console.log(`   Success rate: ${Math.round(updated/totalCount*100)}%`);
            console.log('');
            console.log('✅ Migration complete!');

        } else {
            console.log('🔄 DRY RUN - No changes made');
            console.log(`   Would have updated ${totalCount} documents`);
        }

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
