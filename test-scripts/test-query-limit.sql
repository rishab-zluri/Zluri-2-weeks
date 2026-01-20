-- Test Query: Character Limit Test (PostgreSQL)
-- 
-- PURPOSE: Test the 10,000 character limit for queries
-- EXPECTED: This query is under the limit and should be accepted
-- 
-- HOW TO USE:
-- 1. Copy this entire query
-- 2. Paste into the Query field in the portal
-- 3. Check the character counter (should show ~9,500 / 10,000)
-- 4. Submit - should be accepted
--
-- This query is intentionally padded with comments to approach the limit

SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    u.updated_at,
    u.last_login,
    COUNT(qr.id) as total_requests,
    COUNT(CASE WHEN qr.status = 'pending' THEN 1 END) as pending_requests,
    COUNT(CASE WHEN qr.status = 'approved' THEN 1 END) as approved_requests,
    COUNT(CASE WHEN qr.status = 'rejected' THEN 1 END) as rejected_requests,
    COUNT(CASE WHEN qr.status = 'completed' THEN 1 END) as completed_requests,
    COUNT(CASE WHEN qr.status = 'failed' THEN 1 END) as failed_requests
FROM users u
LEFT JOIN query_requests qr ON u.id = qr.user_id
WHERE u.is_active = true
GROUP BY u.id, u.email, u.name, u.role, u.created_at, u.updated_at, u.last_login
ORDER BY u.created_at DESC
LIMIT 100;

-- Padding comments to increase character count for testing
-- This is a test query to verify the 10,000 character limit
-- The portal should accept queries up to 10,000 characters
-- This query is intentionally padded with comments
-- Line 1: Testing character limit enforcement
-- Line 2: Testing character limit enforcement
-- Line 3: Testing character limit enforcement
-- Line 4: Testing character limit enforcement
-- Line 5: Testing character limit enforcement
-- Line 6: Testing character limit enforcement
-- Line 7: Testing character limit enforcement
-- Line 8: Testing character limit enforcement
-- Line 9: Testing character limit enforcement
-- Line 10: Testing character limit enforcement
-- Line 11: Testing character limit enforcement
-- Line 12: Testing character limit enforcement
-- Line 13: Testing character limit enforcement
-- Line 14: Testing character limit enforcement
-- Line 15: Testing character limit enforcement
-- Line 16: Testing character limit enforcement
-- Line 17: Testing character limit enforcement
-- Line 18: Testing character limit enforcement
-- Line 19: Testing character limit enforcement
-- Line 20: Testing character limit enforcement
-- Line 21: Testing character limit enforcement
-- Line 22: Testing character limit enforcement
-- Line 23: Testing character limit enforcement
-- Line 24: Testing character limit enforcement
-- Line 25: Testing character limit enforcement
-- Line 26: Testing character limit enforcement
-- Line 27: Testing character limit enforcement
-- Line 28: Testing character limit enforcement
-- Line 29: Testing character limit enforcement
-- Line 30: Testing character limit enforcement
-- Line 31: Testing character limit enforcement
-- Line 32: Testing character limit enforcement
-- Line 33: Testing character limit enforcement
-- Line 34: Testing character limit enforcement
-- Line 35: Testing character limit enforcement
-- Line 36: Testing character limit enforcement
-- Line 37: Testing character limit enforcement
-- Line 38: Testing character limit enforcement
-- Line 39: Testing character limit enforcement
-- Line 40: Testing character limit enforcement
-- Line 41: Testing character limit enforcement
-- Line 42: Testing character limit enforcement
-- Line 43: Testing character limit enforcement
-- Line 44: Testing character limit enforcement
-- Line 45: Testing character limit enforcement
-- Line 46: Testing character limit enforcement
-- Line 47: Testing character limit enforcement
-- Line 48: Testing character limit enforcement
-- Line 49: Testing character limit enforcement
-- Line 50: Testing character limit enforcement
-- Line 51: Testing character limit enforcement
-- Line 52: Testing character limit enforcement
-- Line 53: Testing character limit enforcement
-- Line 54: Testing character limit enforcement
-- Line 55: Testing character limit enforcement
-- Line 56: Testing character limit enforcement
-- Line 57: Testing character limit enforcement
-- Line 58: Testing character limit enforcement
-- Line 59: Testing character limit enforcement
-- Line 60: Testing character limit enforcement
-- Line 61: Testing character limit enforcement
-- Line 62: Testing character limit enforcement
-- Line 63: Testing character limit enforcement
-- Line 64: Testing character limit enforcement
-- Line 65: Testing character limit enforcement
-- Line 66: Testing character limit enforcement
-- Line 67: Testing character limit enforcement
-- Line 68: Testing character limit enforcement
-- Line 69: Testing character limit enforcement
-- Line 70: Testing character limit enforcement
-- Line 71: Testing character limit enforcement
-- Line 72: Testing character limit enforcement
-- Line 73: Testing character limit enforcement
-- Line 74: Testing character limit enforcement
-- Line 75: Testing character limit enforcement
-- Line 76: Testing character limit enforcement
-- Line 77: Testing character limit enforcement
-- Line 78: Testing character limit enforcement
-- Line 79: Testing character limit enforcement
-- Line 80: Testing character limit enforcement
-- Line 81: Testing character limit enforcement
-- Line 82: Testing character limit enforcement
-- Line 83: Testing character limit enforcement
-- Line 84: Testing character limit enforcement
-- Line 85: Testing character limit enforcement
-- Line 86: Testing character limit enforcement
-- Line 87: Testing character limit enforcement
-- Line 88: Testing character limit enforcement
-- Line 89: Testing character limit enforcement
-- Line 90: Testing character limit enforcement
-- Line 91: Testing character limit enforcement
-- Line 92: Testing character limit enforcement
-- Line 93: Testing character limit enforcement
-- Line 94: Testing character limit enforcement
-- Line 95: Testing character limit enforcement
-- Line 96: Testing character limit enforcement
-- Line 97: Testing character limit enforcement
-- Line 98: Testing character limit enforcement
-- Line 99: Testing character limit enforcement
-- Line 100: Testing character limit enforcement
-- Line 101: Testing character limit enforcement
-- Line 102: Testing character limit enforcement
-- Line 103: Testing character limit enforcement
-- Line 104: Testing character limit enforcement
-- Line 105: Testing character limit enforcement
-- Line 106: Testing character limit enforcement
-- Line 107: Testing character limit enforcement
-- Line 108: Testing character limit enforcement
-- Line 109: Testing character limit enforcement
-- Line 110: Testing character limit enforcement
-- Line 111: Testing character limit enforcement
-- Line 112: Testing character limit enforcement
-- Line 113: Testing character limit enforcement
-- Line 114: Testing character limit enforcement
-- Line 115: Testing character limit enforcement
-- Line 116: Testing character limit enforcement
-- Line 117: Testing character limit enforcement
-- Line 118: Testing character limit enforcement
-- Line 119: Testing character limit enforcement
-- Line 120: Testing character limit enforcement
-- Line 121: Testing character limit enforcement
-- Line 122: Testing character limit enforcement
-- Line 123: Testing character limit enforcement
-- Line 124: Testing character limit enforcement
-- Line 125: Testing character limit enforcement
-- Line 126: Testing character limit enforcement
-- Line 127: Testing character limit enforcement
-- Line 128: Testing character limit enforcement
-- Line 129: Testing character limit enforcement
-- Line 130: Testing character limit enforcement
-- Line 131: Testing character limit enforcement
-- Line 132: Testing character limit enforcement
-- Line 133: Testing character limit enforcement
-- Line 134: Testing character limit enforcement
-- Line 135: Testing character limit enforcement
-- Line 136: Testing character limit enforcement
-- Line 137: Testing character limit enforcement
-- Line 138: Testing character limit enforcement
-- Line 139: Testing character limit enforcement
-- Line 140: Testing character limit enforcement
-- Line 141: Testing character limit enforcement
-- Line 142: Testing character limit enforcement
-- Line 143: Testing character limit enforcement
-- Line 144: Testing character limit enforcement
-- Line 145: Testing character limit enforcement
-- Line 146: Testing character limit enforcement
-- Line 147: Testing character limit enforcement
-- Line 148: Testing character limit enforcement
-- Line 149: Testing character limit enforcement
-- Line 150: Testing character limit enforcement

-- End of test query
-- Total characters: ~9,500 (under 10,000 limit)
