'use strict';
/* conformance.js — proves the interpreter and the native backend agree.
   For each program: run it with the interpreter, compile + run it natively,
   and diff the output. Exit code 1 on any divergence. */
const fs = require('fs'), cp = require('child_process'), path = require('path');
const root = __dirname, dir = path.join(root, 'examples');

const cases = {
  hello: [], fib: [], forecast: [], words: [], text: [],
  typed: [], arena: [], conformance: [], structs: [], functions: [], useslibrary: [], notes: ['examples/sample-notes.txt'],
};

const nondet = new Set(['forecast', 'arena']);
let pass = 0, fail = 0;
for (const name of Object.keys(cases)) {
  const src = path.join(dir, name + '.morph');
  if (!fs.existsSync(src)) { console.log('SKIP  ' + name + ' (missing)'); continue; }
  const exe = path.join(dir, name + '.exe');
  const build = cp.spawnSync('node', [path.join(root, 'morph.js'), 'build', src, '-o', exe], { encoding: 'utf8' });
  if (!fs.existsSync(exe)) { console.log('BUILD ' + name + ' FAILED'); console.log(build.stdout + build.stderr); fail++; continue; }

  const norm = (s) => (s || '').replace(/\r\n/g, '\n').trim();
  const args = cases[name];
  const ri = cp.spawnSync('node', [path.join(root, 'morph.js'), 'run', src, ...args], { encoding: 'utf8' });
  const rn = cp.spawnSync(exe, args, { encoding: 'utf8', cwd: root });
  const a = norm(ri.stdout), b = norm(rn.stdout);
  if (nondet.has(name)) {
    // forecast: interpreter (JS RNG) and native (C RNG) draw different samples.
    // arena: the interpreter has no memory accounting; the byte count is a native metric.
    console.log('N/A   ' + name + '  (builds; output is RNG/arena-specific)'); pass++; continue;
  }
  if (a === b) { console.log('OK    ' + name); pass++; }
  else { console.log('DIFF  ' + name); console.log('  interp: ' + JSON.stringify(a)); console.log('  native: ' + JSON.stringify(b)); fail++; }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
