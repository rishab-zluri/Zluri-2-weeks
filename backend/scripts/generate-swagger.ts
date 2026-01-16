
/**
 * Generate Swagger/OpenAPI Spec JSON
 *
 * Usage: npx ts-node scripts/generate-swagger.ts
 */

import fs from 'fs';
import path from 'path';
import { swaggerSpec } from '../src/config/swagger';

const OUTPUT_FILE = path.join(__dirname, '../swagger.json');

try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(swaggerSpec, null, 2));
    console.log(`✅ Swagger specification generated successfully at: ${OUTPUT_FILE}`);
} catch (error) {
    console.error('❌ Failed to generate swagger spec:', error);
    process.exit(1);
}
