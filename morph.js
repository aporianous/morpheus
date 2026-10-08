#!/usr/bin/env node
/* morph — the Morpheus CLI.
   node morph.js run  <file.morph> [args...]   run a program (batch)
   node morph.js play <file.morph>             run a game/app (host-driven loop) */
'use strict';
const fs = require('fs');
const path = require('path');
const { runMorpheus } = require('./interp.js');

const [cmd, file, ...rest] = process.argv.slice(2);
if ((cmd !== 'run' && cmd !== 'play' && cmd !== 'build') || !file) {
  process.stdout.write('Usage:\n  node morph.js run   <file.morph> [args...]\n  node morph.js play  <file.morph>\n  node morph.js build <file.morph> [-o out.exe]   # compile to a native binary\n');
  process.exit(2);
}
const abs = path.resolve(file);
const baseDir = path.dirname(abs);

if (cmd === 'build') {
  const { compileToCpp } = require('./morphc.js');
  const cp = require('child_process');
  const cppPath = abs.replace(/\.morph$/i, '') + '.cpp';
  try { fs.writeFileSync(cppPath, compileToCpp(abs)); }
  catch (e) { process.stderr.write('compile error: ' + (e && e.message || e) + '\n'); process.exit(1); }
  const outExe = rest[0] ? path.resolve(rest[0]) : abs.replace(/\.morph$/i, '') + '.exe';
  const env = Object.assign({}, process.env);
  env.PATH = 'C:\\Perseus\\tools\\mingw64\\bin;' + (env.PATH || '');
  process.stdout.write('C++: ' + cppPath + '\n');
  const r = cp.spawnSync('g++', ['-std=c++17', '-O2', '-static', cppPath, '-o', outExe], { stdio: 'inherit', env });
  if (r.error) { process.stderr.write('could not run g++: ' + r.error.message + '\n'); process.exit(1); }
  if (r.status !== 0) { process.stderr.write('build failed\n'); process.exit(1); }
  process.stdout.write('Built ' + outExe + '\n');
  process.exit(0);
}

let lastKey = '';
const host = {
  clear: () => process.stdout.write('\x1b[2J\x1b[H'),
  sleep: (ms) => { const sab = new Int32Array(new SharedArrayBuffer(4)); Atomics.wait(sab, 0, 0, Math.max(0, ms | 0)); },
  key: () => lastKey,
};
const common = {
  basePath: abs,
  argv: rest,
  host,
  resolve: (p, from) => path.resolve(from && from[0] !== '<' ? path.dirname(from) : baseDir, p),
  readFile: (p) => fs.readFileSync(p, 'utf8'),
  writeFile: (p, t) => fs.writeFileSync(p, t),
  env: (k) => process.env[k],
};

if (cmd === 'run') {
  const r = runMorpheus(fs.readFileSync(abs, 'utf8'), common);
  if (r.output) process.stdout.write(r.output + '\n');
  if (r.error) { process.stderr.write('Error: ' + r.error + '\n'); process.exit(1); }
  process.exit(0);
}

// ---- play: host owns the keyboard + the frame clock; Morpheus owns the logic ----
const isTTY = !!(process.stdin.isTTY && process.stdout.isTTY);
if (isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (buf) => {
  for (const ch of buf.toString('utf8')) {
    if (ch === '\u0003') { cleanup(); process.exit(0); }            // Ctrl-C
    if (ch === 'A') lastKey = 'w'; else if (ch === 'B') lastKey = 's';
    else if (ch === 'C') lastKey = 'd'; else if (ch === 'D') lastKey = 'a';
    else if (/[wasdgqWASDGQ]/.test(ch)) lastKey = ch.toLowerCase();
  }
});

let iv = null;
function cleanup() { try { if (isTTY) process.stdin.setRawMode(false); } catch (e) {} if (iv) clearInterval(iv); process.stdin.pause(); }

runMorpheus(fs.readFileSync(abs, 'utf8'), Object.assign({}, common, {
  deferMain: true,
  onReady: ({ call, out }) => {
    iv = setInterval(() => {
      out.length = 0;
      let status;
      try { status = call('frame', lastKey); }
      catch (e) { cleanup(); process.stderr.write('Error: ' + (e && e.message || e) + '\n'); process.exit(1); }
      lastKey = '';
      if (out.length) process.stdout.write(out.join('\n') + '\n');
      if (status === 'over' || status === 'win') {
        cleanup();
        process.stdout.write('\n' + (status === 'win' ? '*** YOU WIN ***' : '*** GAME OVER ***') + '\n');
        process.exit(0);
      }
    }, 140);
  },
}));
