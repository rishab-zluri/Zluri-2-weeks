// @ts-nocheck
/**
 * MongoDB CRUD Operations Script
 * 
 * Demonstrates INSERT, UPDATE, DELETE operations in the sandbox.
 * ⚠️ CAUTION: Modifies data - use on test databases only!
 */

async function main() {
    console.log('=== MongoDB CRUD Test ===');

    const testCollection = db.collection('test_scripts');

    // INSERT ONE
    console.log('Inserting test document...');
    const insertResult = await testCollection.insertOne({
        name: 'test_entry',
        value: Math.floor(Math.random() * 1000),
        tags: ['test', 'automated'],
        createdAt: new Date()
    });
    console.log('Inserted ID:', insertResult.insertedId);

    // INSERT MANY
    console.log('Inserting multiple documents...');
    const insertManyResult = await testCollection.insertMany([
        { name: 'batch_1', value: 100, createdAt: new Date() },
        { name: 'batch_2', value: 200, createdAt: new Date() },
    ]);
    console.log('Inserted IDs:', insertManyResult.insertedIds);

    // FIND
    console.log('Finding all test documents...');
    const docs = await testCollection.find({ name: { $regex: /^test|^batch/ } }).toArray();
    console.log('Found documents:', docs.length);
    console.log('Sample:', JSON.stringify(docs[0], null, 2));

    // UPDATE
    console.log('Updating document...');
    const updateResult = await testCollection.updateOne(
        { name: 'test_entry' },
        { $inc: { value: 10 }, $set: { updatedAt: new Date() } }
    );
    console.log('Modified count:', updateResult.modifiedCount);

    // AGGREGATE
    console.log('Running aggregation...');
    const aggResult = await testCollection.aggregate([
        { $match: { value: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$value' }, count: { $sum: 1 } } }
    ]).toArray();
    console.log('Aggregation result:', aggResult);

    // COUNT
    const count = await testCollection.countDocuments({ name: { $regex: /^test|^batch/ } });
    console.log('Total matching documents:', count);

    // DELETE (optional - commented out for safety)
    // console.log('Deleting test documents...');
    // await testCollection.deleteMany({ name: { $regex: /^test|^batch/ } });

    console.log('=== CRUD Test Complete ===');
}

main();
