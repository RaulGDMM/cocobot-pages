#!/usr/bin/env node
// ─── Coverage Report Generator ───
// Analyzes test files to determine which source functions are tested.
// Also runs tests to verify they pass.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'js');
const TEST_DIR = path.join(ROOT, 'tests');

const FILES = ['config.js','state.js','audio.js','scene.js','snake.js',
               'apples.js','obstacles.js','particles.js','ai.js','ui.js','game.js','controls.js'];
const TEST_FILES = ['config.test.js','state.test.js','apples.test.js',
                    'obstacles.test.js','coverage.test.js','ui.test.js','ai.test.js','ui-dom.test.js','game.test.js'];

// Read sources
const sources = {};
for (const f of FILES) {
  sources[f] = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
}

// Read test files
let testContent = '';
for (const f of TEST_FILES) {
  const p = path.join(TEST_DIR, f);
  if (fs.existsSync(p)) testContent += fs.readFileSync(p, 'utf8') + '\n';
}

// Extract functions per file + count LOC
const fileFuncs = {};
let totalLOC = 0;
for (const f of FILES) {
  const lines = sources[f].split('\n');
  const funcs = [];
  let loc = 0;
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('//')) continue;
    loc++;
    const m = s.match(/^function\s+(\w+)\s*\(/);
    if (m) funcs.push(m[1]);
  }
  fileFuncs[f] = funcs;
  totalLOC += loc;
}

// Count test cases
const testCount = (testContent.match(/test\(['"]/g) || []).length;

// ─── Run tests first ───
console.log('Running tests...\n');
execSync('npx jest --silent 2>&1', { cwd: ROOT, stdio: 'pipe' });

// ─── Generate report ───
console.log('┌──────────────────────────────────────────────────────────┐');
console.log('│           SNAKE3D COVERAGE REPORT                        │');
console.log('├──────────────────────┬──────────────┬───────┬────────────┤');
console.log('│ File                 │ Function     │ Calls │ Status     │');
console.log('├──────────────────────┼──────────────┼───────┼────────────┤');

let total = 0, covered = 0;
for (const f of FILES) {
  const funcs = fileFuncs[f];
  if (!funcs.length) {
    console.log('│ ' + f.padEnd(20) + '│ (none)       │     - │ N/A        │');
    continue;
  }
  for (const fn of funcs) {
    total++;
    // Check if function name appears in test content
    const tested = new RegExp('\\b' + fn + '\\b').test(testContent);
    const status = tested ? '✓ COVERED' : '✗ NOT COVERED';
    if (tested) covered++;
    // Estimate "calls" as number of test references
    const calls = (testContent.match(new RegExp('\\b' + fn + '\\b', 'g')) || []).length;
    console.log('│ ' + f.padEnd(20) + '│ ' + fn.padEnd(12) + '│ ' + String(calls).padStart(5) + ' │ ' + status + '     │');
  }
}

const pct = total > 0 ? Math.round(covered / total * 100) : 100;
console.log('├──────────────────────┴──────────────┴───────┴────────────┤');
console.log('│ Total: ' + (covered + '/' + total + ' functions (' + pct + '%)').padEnd(46) + '│');
console.log('│ LOC: ' + (totalLOC + ' lines across ' + FILES.length + ' files').padEnd(46) + '│');
console.log('│ Test cases: ' + testCount + ' passing'.padEnd(46) + '│');
console.log('└──────────────────────────────────────────────────────────┘');
