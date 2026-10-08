#!/usr/bin/env node
/* morph — the Morpheus CLI.
   node morph.js run  <file.morph> [args...]   run a program (batch)
   node morph.js play <file.morph>             run a game/app (host-driven loop) */
'use strict';
const fs = require('fs');
const path = require('path');
const { runMorpheus } = require('./interp.js');

const [cmd, file, ...rest] = process.argv.slice(2);
if ((cmd !== 'run' && cmd !== 'play') || !file) {
  process.stdout.write('Usage:\n  node morph.js run  <file.morph> [args...]\n  node morph.js play <file.morph>\n');
  process.exit(2);
}
const abs = path.resolve(file);
const baseDir = path.dirname(abs);

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
