/**
 * Test Script: Successful Completion (Under 30s)
 * 
 * PURPOSE: Verify that scripts under 30 seconds complete successfully
 * EXPECTED: Script should complete without timeout
 * 
 * HOW TO USE:
 * 1. Upload this script via the portal
 * 2. Submit for approval
 * 3. After approval, script should complete successfully
 */

console.log('Script started at:', new Date().toISOString());
console.log('This script will run for 25 seconds (under timeout)...');

const startTime = Date.now();
const targetDuration = 25000; // 25 seconds (under 30s timeout)

// Busy wait loop with progress updates
while (Date.now() - startTime < targetDuration) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    // Log every 5 seconds
    if (elapsed % 5 === 0 && elapsed > 0) {
        const lastLog = Math.floor((Date.now() - startTime - 1000) / 1000);
        if (lastLog !== elapsed) {
            console.log(`Progress: ${elapsed} / 25 seconds`);
        }
    }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`Script completed successfully in ${totalTime} seconds`);
console.log('Completed at:', new Date().toISOString());
console.log('✓ This script should complete without timeout');
