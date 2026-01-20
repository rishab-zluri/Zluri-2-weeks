-- Test Query: Query Timeout Test (PostgreSQL)
-- 
-- PURPOSE: Test the 30 second query timeout
-- EXPECTED: Query should timeout after 30 seconds
-- 
-- HOW TO USE:
-- 1. Copy this query
-- 2. Paste into the Query field in the portal
-- 3. Submit for approval
-- 4. After approval, query should timeout with error
--
-- WARNING: This query uses pg_sleep to simulate a long-running query
-- It will block for 35 seconds, exceeding the 30 second timeout

SELECT 
    'Starting long-running query...' as message,
    NOW() as start_time;

-- Sleep for 35 seconds (exceeds 30s timeout)
SELECT pg_sleep(35);

-- This should never be reached due to timeout
SELECT 
    'Query completed!' as message,
    NOW() as end_time;

-- If you see the completion message, the timeout did NOT work!
