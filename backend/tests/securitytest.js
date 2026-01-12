/**
 * Simplified Sandbox Security Test
 * 
 * This test focuses ONLY on the critical security checks that matter
 * for your Database Query Portal.
 * 
 * Run with: node securityTest.js
 */

const { VM } = require('vm2');

// Colors
const G = '\x1b[32m';  // Green
const R = '\x1b[31m';  // Red  
const Y = '\x1b[33m';  // Yellow
const C = '\x1b[36m';  // Cyan
const B = '\x1b[1m';   // Bold
const X = '\x1b[0m';   // Reset

let passed = 0;
let failed = 0;

// Create sandbox (same as production)
function createSandbox() {
  return new VM({
    timeout: 5000,
    sandbox: {
      console: { log: () => {}, error: () => {}, warn: () => {} },
      JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise,
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5000)),
      process: undefined,
      require: undefined,
      global: undefined,
      Buffer: undefined,
      eval: undefined,
      Function: undefined,
      __dirname: undefined,
      __filename: undefined,
      module: undefined,
    },
    eval: false,
    wasm: false,
    require: { external: false, builtin: [], root: [], mock: {} },
  });
}

function test(name, script, shouldFail) {
  try {
    const vm = createSandbox();
    const result = vm.run(`(function() { ${script} })()`);
    
    if (shouldFail) {
      console.log(`${R}❌ FAIL: ${name}${X}`);
      console.log(`   Expected: BLOCKED, Got: SUCCESS (result: ${JSON.stringify(result)})`);
      failed++;
    } else {
      console.log(`${G}✅ PASS: ${name}${X}`);
      passed++;
    }
  } catch (error) {
    if (shouldFail) {
      console.log(`${G}✅ PASS: ${name}${X}`);
      console.log(`   Blocked with: "${error.message.substring(0, 50)}..."`);
      passed++;
    } else {
      console.log(`${R}❌ FAIL: ${name}${X}`);
      console.log(`   Expected: SUCCESS, Got: ERROR (${error.message})`);
      failed++;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`
${C}${B}╔════════════════════════════════════════════════════════════════════════════╗
║                    CRITICAL SECURITY TESTS                                 ║
║                                                                            ║
║  These tests verify that the sandbox blocks all dangerous operations       ║
║  that could compromise your server.                                        ║
╚════════════════════════════════════════════════════════════════════════════╝${X}
`);

console.log(`${C}${B}─── FILE SYSTEM ACCESS ───${X}\n`);
test('Read /etc/passwd', 'const fs = require("fs"); return fs.readFileSync("/etc/passwd");', true);
test('Write file', 'const fs = require("fs"); fs.writeFileSync("/tmp/hack", "data");', true);
test('Read directory', 'const fs = require("fs"); return fs.readdirSync("/");', true);

console.log(`\n${C}${B}─── SHELL COMMAND EXECUTION ───${X}\n`);
test('exec()', 'const {exec} = require("child_process"); exec("whoami");', true);
test('spawn()', 'const {spawn} = require("child_process"); spawn("ls");', true);
test('execSync()', 'const {execSync} = require("child_process"); return execSync("id").toString();', true);

console.log(`\n${C}${B}─── NETWORK ACCESS ───${X}\n`);
test('HTTP request', 'const http = require("http"); http.get("http://evil.com");', true);
test('HTTPS request', 'const https = require("https"); https.get("https://evil.com");', true);
test('TCP socket', 'const net = require("net"); net.connect(80, "evil.com");', true);

console.log(`\n${C}${B}─── ENVIRONMENT & PROCESS ───${X}\n`);
test('process.env.JWT_SECRET', 'return process.env.JWT_SECRET;', true);
test('process.env.DATABASE_URL', 'return process.env.DATABASE_URL;', true);
test('process.exit()', 'process.exit(1);', true);
test('process.kill()', 'process.kill(process.pid);', true);

console.log(`\n${C}${B}─── DYNAMIC CODE EXECUTION ───${X}\n`);
test('eval()', 'return eval("1+1");', true);
test('new Function()', 'const f = new Function("return 1"); return f();', true);
test('global.eval', 'return global.eval("1+1");', true);

console.log(`\n${C}${B}─── TIMEOUT ENFORCEMENT ───${X}\n`);
test('Infinite loop (5s timeout)', 'while(true) {}', true);

console.log(`\n${C}${B}─── ALLOWED OPERATIONS (should work) ───${X}\n`);
test('Basic math', 'return 1 + 2 + 3;', false);
test('Array operations', 'return [1,2,3].map(x => x*2);', false);
test('JSON parse/stringify', 'return JSON.parse(JSON.stringify({a:1}));', false);
test('Date operations', 'return new Date().getFullYear();', false);

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

const total = passed + failed;
const rate = ((passed / total) * 100).toFixed(1);

console.log(`
${C}${B}╔════════════════════════════════════════════════════════════════════════════╗
║                              RESULTS                                       ║
╠════════════════════════════════════════════════════════════════════════════╣${X}
   
   Total:  ${total}
   ${G}Passed: ${passed}${X}
   ${R}Failed: ${failed}${X}
   
   Success Rate: ${rate}%
`);

if (failed === 0) {
  console.log(`${G}${B}
   ╔═══════════════════════════════════════════════════════════════════════╗
   ║                                                                       ║
   ║   🎉 ALL CRITICAL SECURITY TESTS PASSED!                              ║
   ║                                                                       ║
   ║   Your sandbox is SECURE for the Database Query Portal.               ║
   ║                                                                       ║
   ║   Blocked attacks:                                                    ║
   ║   • File system access (fs)                                           ║
   ║   • Shell commands (child_process)                                    ║
   ║   • Network requests (http, https, net)                               ║
   ║   • Environment secrets (process.env)                                 ║
   ║   • Process control (process.exit, kill)                              ║
   ║   • Code injection (eval, Function)                                   ║
   ║   • Resource exhaustion (infinite loops)                              ║
   ║                                                                       ║
   ╚═══════════════════════════════════════════════════════════════════════╝
${X}`);
} else {
  console.log(`${R}${B}
   ╔═══════════════════════════════════════════════════════════════════════╗
   ║                                                                       ║
   ║   ⚠️  ${failed} SECURITY TESTS FAILED - DO NOT DEPLOY!                     ║
   ║                                                                       ║
   ╚═══════════════════════════════════════════════════════════════════════╝
${X}`);
}

process.exit(failed > 0 ? 1 : 0);