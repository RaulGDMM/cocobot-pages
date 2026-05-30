#!/usr/bin/env node
// ─── Generate snake3d-bundle.js for Jest ───
// Concatenates js/*.js into a single file for vm.runInContext in jest.setup.js.
// No transformations — raw source concatenation.

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'js');
const files = [
  'config.js', 'state.js', 'audio.js', 'scene.js', 'snake.js',
  'apples.js', 'obstacles.js', 'particles.js', 'ai.js', 'ui.js', 'game.js', 'controls.js'
];

let bundled = '// ─── Snake3D Bundle for Jest ───\n';
bundled += '// Auto-generated from js/*.js. DO NOT edit manually.\n';
bundled += '// Loaded via vm.runInContext in jest.setup.js.\n\n';

files.forEach(f => {
  let content = fs.readFileSync(path.join(srcDir, f), 'utf8');
  // Remove module.exports blocks (not needed in browser/vm context)
  content = content.replace(/\n\/\/ ─── Module exports.*\nif\(typeof module.*?\n}\s*/s, '');
  bundled += '// === ' + f + ' ===\n' + content + '\n\n';
});

const outPath = path.join(__dirname, '..', 'tests', 'snake3d-bundle.js');
fs.writeFileSync(outPath, bundled);
console.log(`Bundle written: ${bundled.length} bytes → ${outPath}`);
