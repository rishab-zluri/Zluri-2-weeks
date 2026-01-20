/**
 * Script Generator: Create Large Script for Testing
 * 
 * PURPOSE: Generate a script that exceeds the 100KB limit
 * EXPECTED: Portal should reject scripts over 100,000 characters
 * 
 * HOW TO USE:
 * 1. Run this script locally: node generate-large-script.js
 * 2. It will create 'large-script-test.js' (110KB)
 * 3. Try to upload the generated file to the portal
 * 4. Should be rejected with error message
 */

const fs = require('fs');

// Generate a script with ~110,000 characters (exceeds 100KB limit)
let scriptContent = `/**
 * Large Script Test
 * This script is intentionally large to test the 100KB limit
 * Generated size: ~110KB
 */

console.log('Large script started');

`;

// Add lots of padding to reach 110KB
const paddingLine = '// Padding line to increase file size - Lorem ipsum dolor sit amet\n';
const targetSize = 110000; // 110KB

while (scriptContent.length < targetSize) {
    scriptContent += paddingLine;
}

scriptContent += `
console.log('Large script completed');
console.log('Total size: ${scriptContent.length} characters');
`;

// Write to file
fs.writeFileSync('large-script-test.js', scriptContent);

console.log('✓ Generated large-script-test.js');
console.log(`  Size: ${scriptContent.length} characters (${(scriptContent.length / 1024).toFixed(2)} KB)`);
console.log(`  Limit: 100,000 characters (100 KB)`);
console.log(`  Status: ${scriptContent.length > 100000 ? '❌ EXCEEDS LIMIT' : '✓ UNDER LIMIT'}`);
console.log('\nTry uploading this file to the portal - it should be REJECTED');
