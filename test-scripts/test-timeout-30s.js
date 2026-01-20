/**
 * Test Script: 30 Second Timeout Test
 * 
 * PURPOSE: Verify that scripts timeout after 30 seconds
 * EXPECTED: Script should be killed after 30 seconds
 * 
 * HOW TO USE:
 * 1. Upload this script via the portal
 * 2. Submit for approval
 * 3. After approval, script should timeout with error
 */

console.log('Script started at:', new Date().toISOString());
console.log('This script will run for 35 seconds to test timeout...');

const startTime = Date.now();
const targetDuration = 35000; // 35 seconds (exceeds 30s timeout)

// Busy wait loop
while (Date.now() - startTime < targetDuration) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // Log every 5 seconds
    if (elapsed % 5 === 0 && elapsed > 0) {
        const lastLog = Math.floor((Date.now() - startTime - 1000) / 1000);
        if (lastLog !== elapsed) {
            console.log(`Still running... ${elapsed} seconds elapsed`);
        }
    }
}

// This should never be reached due to timeout
console.log('Script completed at:', new Date().toISOString());
console.log('If you see this message, the timeout did NOT work!');
