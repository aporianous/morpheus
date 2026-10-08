'use strict';
/* divergence.js — the conformance SPEC harness.
   Runs many edge-case programs AND a deterministic fuzzer through both the
   reference interpreter and the native backend, and diffs the output.
   Any divergence is a bug. Exit 1 on failure. */
const fs = require('fs'), cp = require('child_process'), path = require('path');
const root = __dirname, tmp = path.join(root, 'examples', '_div');

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

// --- edge-case programs (semantics that MUST agree) ---
const edge = {
  'map-order': `sovereign main(){ let m = { "c": 3, "a": 1, "b": 2 } print(m) print(m.keys()) print(m.values()) }`,
  'num-format': `sovereign main(){ print(0.5) print(1) print(1.25) print(1.0/3.0) print(100.0) print(-2.5) print(10/4) }`,
  'int-float': `sovereign main(){ print(7/2) print(7.0/2) print(2*3+4) print(2+3*4) print(-3) print(0-3) }`,
  'neg-index': `sovereign main(){ let a = [1,2,3,4] print(a[0]) print(a[3]) }`,
  'str-ops': `sovereign main(){ let s = "Hello, World" print(upper(s)) print(lower(s)) print(len(s)) print(substr(s,0,5)) print(substr(s,7)) print(contains(s,"World")) print(index_of(s,"o")) print(split(s,", ")) print(join(split(s," "),"-")) print(starts_with(s,"He")) print(ends_with(s,"ld")) print(replace(s,"l","L")) print(repeat("ab",3)) }`,
  'list-ops': `sovereign main(){ let a=[3,1,2] print(sort(a)) print(reverse(a)) print(len(a)) print(sum(a)) print(min_of(a)) print(max_of(a)) print(contains(a,2)) print(index_of(a,1)) print(0..4) print(range(2,8)) print(range(0,10,3)) }`,
  'nested': `sovereign main(){ let m = { "x": [1,2], "y": { "z": 9 } } print(m["x"]) print(m["y"]["z"]) print(m["y"]) print(len(m)) }`,
  'forin': `sovereign main(){ let t=0 for x in [10,20,30] { let t = t+x } print(t) for c in "abc" { print(c) } for v in 0..3 { print(v) } }`,
  'break-cont': `sovereign main(){ for v in 0..10 { when v == 3 { continue } when v == 6 { break } print(v) } }`,
  'ternary': `sovereign main(){ print(1 < 2 ? "a" : "b") print(1 > 2 ? "a" : "b") print(len([1]) == 1 ? 100 : 0) }`,
  'slice': `sovereign main(){ let a=[0,1,2,3,4,5] print(a[1:4]) print(a[2:]) print(a[:3]) print(a[:]) }`,
  'map-mut': `sovereign main(){ let m = { "a": 1 } put(m, "b", 2) print(m) print(m.has("b")) print(m.get("a")) print(m.get("z", -1)) del(m, "a") print(m) print(m.keys()) }`,
  'bool-eq': `sovereign main(){ print(true) print(false) print(1 == 1) print(1 != 2) print(2 > 1) print(not true) print(true and false) print(true or false) }`,
  'division': `sovereign main(){ print(1/3) print(2/3*3) print(10 % 3) print(-7 % 3) print(2 ** 10) }`,
  'recurse': `sovereign fib(n){ when n < 2 { signal n } signal fib(n-1)+fib(n-2) } sovereign main(){ print(fib(15)) }`,
  'forin-kv-map': `sovereign main(){ let m={"b":2,"a":1,"c":3} for k,v in m { print(k) print(v) } }`,
  'forin-kv-list': `sovereign main(){ for i,x in [10,20,30] { print(i) print(x) } }`,
  'forin-kv-str': `sovereign main(){ for i,c in "abc" { print(i) print(c) } }`,
  'struct-basic': `struct Point { x, y } sovereign main(){ let p=Point(3,4) print(p) print(p.x) print(p.y) }`,
  'struct-mutate': `struct P { x } sovereign main(){ let p=P(1) p.x=7 print(p.x) print(p) }`,
  'struct-alias': `struct P { x } sovereign main(){ let a=P(1) let b=a b.x=9 print(a.x) }`,
  'struct-nested': `struct P { x, y } struct L { a, b } sovereign main(){ let l=L(P(1,2),P(3,4)) print(l.b.y) print(l.a) }`,
  'struct-in-list': `struct P { x, y } sovereign main(){ let ps=[P(1,2),P(3,4)] print(ps[1].y) print(len(ps)) }`,
  'index-assign': `sovereign main(){ let a=[1,2,3] a[1]=9 print(a) let m={"k":1} m["k"]=5 print(m) }`,
  'lambda-basic': `sovereign main(){ let d=fn(x){ signal x*2 } print(d(21)) print(d(0)) print(d) print(type(d)) }`,
  'lambda-return': `sovereign mk(n){ signal fn(x){ signal x+n } } sovereign main(){ let a=mk(10) let b=mk(100) print(a(1)) print(b(1)) print(a(2)) }`,
  'lambda-value': `sovereign main(){ let base=5 let f=fn(x){ signal x+base } let base=100 print(f(1)) print(base) }`,
  'lambda-mutable': `sovereign main(){ let c=0 let inc=fn(){ let c=c+1 signal c } print(inc()) print(inc()) print(inc()) print(c) }`,
  'lambda-nested': `sovereign main(){ let add=fn(x){ signal fn(y){ signal x+y } } let add5=add(5) print(add5(3)) }`,
  'lambda-hof': `sovereign main(){ let fs=[fn(x){signal x+1},fn(x){signal x*10}] let t=0 for f in fs { let t=t+f(2) } print(t) }`,
  'lambda-arg': `sovereign apply(f,x){ signal f(x) } sovereign main(){ print(apply(fn(y){signal y*y}, 7)) }`,
  // these MUST fail on both backends (error parity)
  'err-call-nonfn': `sovereign main(){ let x=3 print(x(1)) }`,
  'err-struct-field': `struct P { x } sovereign main(){ let p=P(1) print(p.z) }`,
  'err-div0': `sovereign main(){ print(1/0) }`,
  'err-oob-list': `sovereign main(){ let a=[1,2] print(a[5]) }`,
  'err-oob-str': `sovereign main(){ let s="ab" print(s[9]) }`,
  'err-missing-key': `sovereign main(){ let m={"a":1} print(m["z"]) }`,
  'err-neg-index': `sovereign main(){ let a=[1,2] print(a[0-1]) }`,
  // and these MUST succeed (recovery paths)
  'ok-get-default': `sovereign main(){ let m={"a":1} print(m.get("z",-1)) print(m.get("a")) }`,
  'ok-slice-clamp': `sovereign main(){ let a=[0,1,2] print(a[1:99]) print(a[0:2]) }`,
};

// --- deterministic fuzzer: random arithmetic/logic expressions over constants ---
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gen(rng, depth) {
  if (depth <= 0) return rng() < 0.5 ? String(Math.floor(rng() * 21) - 10) : (Math.floor(rng() * 200) / 10).toFixed(1);
  const ops = ['+', '-', '*', '%', 'min', 'max', 'abs'];
  const op = ops[Math.floor(rng() * ops.length)];
  if (op === 'abs') return '(0 - (' + gen(rng, depth - 1) + '))';
  if (op === 'min' || op === 'max') return op + '(' + gen(rng, depth - 1) + ', ' + gen(rng, depth - 1) + ')';
  if (op === '%') return '(' + gen(rng, depth - 1) + ' % ' + (1 + Math.floor(rng() * 9)) + ')';
  return '(' + gen(rng, depth - 1) + ' ' + op + ' ' + gen(rng, depth - 1) + ')';
}

function runInterp(file, args) { const r = cp.spawnSync('node', [path.join(root, 'morph.js'), 'run', file, ...args], { encoding: 'utf8' }); return { out: r.stdout, code: r.status }; }
function build(file, exe) { return cp.spawnSync('node', [path.join(root, 'morph.js'), 'build', file, '-o', exe], { encoding: 'utf8' }); }
function runNative(exe, args) { const r = cp.spawnSync(exe, args, { encoding: 'utf8', cwd: root }); return { out: r.stdout, code: r.status }; }

const norm = (s) => (s || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
let pass = 0, fail = 0;

// success parity: both succeed AND identical stdout.
// error parity: both FAIL (non-zero exit), regardless of message text.
function check(name, src, args = []) {
  const f = path.join(tmp, name.replace(/[^\w.-]/g, '_') + '.morph');
  fs.writeFileSync(f, src);
  const exe = f.replace(/\.morph$/, '.exe');
  const b = build(f, exe);
  if (!fs.existsSync(exe)) { console.log('BUILD FAIL ' + name); console.log(b.stdout + b.stderr); fail++; return; }
  const i = runInterp(f, args), n = runNative(exe, args);
  const iErr = i.code !== 0, nErr = n.code !== 0;
  if (iErr !== nErr) {
    console.log('DIFF  ' + name + '  (error mismatch: interp ' + (iErr ? 'ERR' : 'ok') + ' / native ' + (nErr ? 'ERR' : 'ok') + ')');
    console.log('  interp: ' + JSON.stringify(norm(i.out))); console.log('  native: ' + JSON.stringify(norm(n.out))); fail++; return;
  }
  if (iErr) { console.log('OK~ERR ' + name); pass++; return; }
  if (norm(i.out) === norm(n.out)) { console.log('OK    ' + name); pass++; }
  else { console.log('DIFF  ' + name); console.log('  interp: ' + JSON.stringify(norm(i.out))); console.log('  native: ' + JSON.stringify(norm(n.out))); fail++; }
}

for (const [name, src] of Object.entries(edge)) check(name, src);

// fuzz: N random programs, each printing a batch of random expressions
const rng = mulberry32(1234);
const FUZZ = 40;
for (let k = 0; k < FUZZ; k++) {
  const exprs = [];
  for (let j = 0; j < 8; j++) exprs.push(gen(rng, 3));
  const src = 'sovereign main(){\n' + exprs.map((e) => '    print(' + e + ')').join('\n') + '\n}\n';
  check('fuzz-' + k, src);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
