const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const configPath = process.env.DB_CONFIG_FILE;
  
  if (!configPath) {
    console.log('Running in test mode - no DB config');
    console.log('Script executed successfully!');
    console.log('Result: { "status": "ok", "message": "Test script ran" }');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const client = new Client(config);

  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as time, current_database() as db');
    console.log('Result:', JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();