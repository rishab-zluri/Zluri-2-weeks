const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/services/script/worker/pythonWorker.py');
const destDir = path.join(__dirname, '../dist/services/script/worker');
const dest = path.join(destDir, 'pythonWorker.py');

// Ensure directory exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Copy file
try {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied pythonWorker.py to ${dest}`);
} catch (err) {
    console.error('❌ Failed to copy pythonWorker.py:', err);
    process.exit(1);
}
