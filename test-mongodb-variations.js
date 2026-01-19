// Test different MongoDB connection string variations
const { MongoClient } = require('mongodb');

const variations = [
    {
        name: 'With authSource=admin',
        uri: 'mongodb+srv://rishab2:rishabacharjee12345@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin'
    },
    {
        name: 'Without authSource',
        uri: 'mongodb+srv://rishab2:rishabacharjee12345@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority'
    },
    {
        name: 'With default database',
        uri: 'mongodb+srv://rishab2:rishabacharjee12345@ships.gwsbr.mongodb.net/admin?retryWrites=true&w=majority'
    },
    {
        name: 'Minimal connection string',
        uri: 'mongodb+srv://rishab2:rishabacharjee12345@ships.gwsbr.mongodb.net/'
    }
];

async function testVariation(variation) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${variation.name}`);
    console.log(`URI: ${variation.uri.replace(/:[^:@]+@/, ':****@')}`);
    console.log('='.repeat(60));
    
    const client = new MongoClient(variation.uri);
    
    try {
        await client.connect();
        console.log('✅ CONNECTION SUCCESSFUL!');
        
        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();
        console.log(`✅ Found ${dbs.databases.length} databases`);
        
        console.log('\n🎉 THIS CONNECTION STRING WORKS! Use this one:');
        console.log(variation.uri);
        
        return true;
        
    } catch (error) {
        console.log('❌ FAILED:', error.message);
        return false;
        
    } finally {
        await client.close();
    }
}

async function testAll() {
    console.log('Testing MongoDB connection with different variations...\n');
    
    for (const variation of variations) {
        const success = await testVariation(variation);
        if (success) {
            console.log('\n✅ Found working connection! Stopping tests.');
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test complete!');
}

testAll().catch(console.error);
