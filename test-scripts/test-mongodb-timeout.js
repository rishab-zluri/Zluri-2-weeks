/**
 * Test Query: MongoDB Timeout Test
 * 
 * PURPOSE: Test the 30 second MongoDB query timeout
 * EXPECTED: Query should timeout after 30 seconds
 * 
 * HOW TO USE:
 * 1. Copy this query
 * 2. Select a MongoDB instance
 * 3. Paste into the Query field in the portal
 * 4. Submit for approval
 * 5. After approval, query should timeout with error
 * 
 * NOTE: This uses $where with a sleep to simulate a slow query
 */

db.users.find({
    $where: function() {
        // Simulate a slow query by sleeping
        // This will cause the query to exceed the 30 second timeout
        sleep(35000); // 35 seconds
        return true;
    }
}).limit(1)
