/**
 * PostgreSQL CRUD Operations Script
 * 
 * Demonstrates INSERT, UPDATE, DELETE operations in the sandbox.
 * ⚠️ CAUTION: Modifies data - use on test databases only!
 */

async function main() {
    console.log('=== PostgreSQL CRUD Test ===');

    // Check if test table exists, create if not
    const tableCheck = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'test_scripts'
    ) as exists
  `);

    if (!tableCheck.rows[0].exists) {
        console.log('Creating test_scripts table...');
        await db.query(`
      CREATE TABLE test_scripts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        value INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Table created!');
    }

    // INSERT
    console.log('Inserting test record...');
    const insertResult = await db.query(
        'INSERT INTO test_scripts (name, value) VALUES ($1, $2) RETURNING *',
        ['test_entry', Math.floor(Math.random() * 1000)]
    );
    console.log('Inserted:', insertResult.rows[0]);

    // SELECT
    console.log('Reading all records...');
    const selectResult = await db.query('SELECT * FROM test_scripts ORDER BY id DESC LIMIT 5');
    console.log('Records:', JSON.stringify(selectResult.rows, null, 2));

    // UPDATE
    console.log('Updating record...');
    const updateResult = await db.query(
        'UPDATE test_scripts SET value = value + 1 WHERE id = $1 RETURNING *',
        [insertResult.rows[0].id]
    );
    console.log('Updated:', updateResult.rows[0]);

    // DELETE (optional - commented out for safety)
    // console.log('Deleting record...');
    // await db.query('DELETE FROM test_scripts WHERE id = $1', [insertResult.rows[0].id]);

    console.log('=== CRUD Test Complete ===');
}

main();
