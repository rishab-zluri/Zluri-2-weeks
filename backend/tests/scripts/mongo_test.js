/**
 * MongoDB Test Script
 * 
 * This script demonstrates how to execute MongoDB operations using the sandbox `db` object.
 * The sandbox provides a pre-connected database wrapper - no need for require('mongodb').
 * 
 * Available globals:
 * - db.collection(name) - Get a collection wrapper
 * - Collection methods: find, findOne, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, aggregate, countDocuments
 * - console.log/error/warn - Output capture
 * - JSON, Math, Date, Array, Object, String, Number - Built-in globals
 */

async function main() {
    console.log('=== MongoDB Test Script ===');
    console.log('Starting test operations...');

    // 1. List collections (using db methods if available)
    console.log('Testing collection operations...');

    // 2. Count documents in a collection
    const usersCollection = db.collection('users');

    // Example: Find documents
    const users = await usersCollection.find({}).toArray();
    console.log('Found users:', users.length);

    // Example: Find with filter
    const activeUsers = await usersCollection.find({ isActive: true }).toArray();
    console.log('Active users:', activeUsers.length);

    // Example: Find one document
    const firstUser = await usersCollection.findOne({});
    if (firstUser) {
        console.log('First user:', JSON.stringify(firstUser, null, 2));
    }

    // Example: Count documents
    const totalCount = await usersCollection.countDocuments({});
    console.log('Total documents:', totalCount);

    console.log('=== Test Complete ===');
}

main();
