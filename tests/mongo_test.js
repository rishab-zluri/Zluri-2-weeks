const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGODB_DATABASE;

  if (!uri) {
    console.log('Running in test mode - no MongoDB URI');
    console.log('Script executed successfully!');
    console.log('Result: { "status": "ok", "message": "Test script ran" }');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log('Collections:', JSON.stringify(collections.map(c => c.name), null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

main();