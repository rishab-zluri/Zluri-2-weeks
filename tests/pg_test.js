async function main() {
  const result = await db.query('SELECT NOW() as time, current_database() as db');
  console.log('Result:', JSON.stringify(result.rows, null, 2));
}

main();