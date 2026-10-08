/* morphc — the Morpheus native backend.
   Compiles a .morph program (the language subset) to standalone C++ that links
   nothing but the standard library. No interpreter, no VM: `g++ → a real .exe`. */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('./interp.js');

const RT = fs.readFileSync(path.join(__dirname, 'runtime', 'morph_rt.h'), 'utf8');

// builtins: name -> { c: C++ function, var: variadic (takes a std::vector<Value>) }
const BUILTINS = {};
for (const [n, c] of Object.entries({
  len: 'rt_len', abs: 'rt_abs', sqrt: 'rt_sqrt', sin: 'rt_sin', cos: 'rt_cos', exp: 'rt_exp',
  pow: 'rt_pow', prophesy_ci: 'rt_ci', random_uniform: 'rt_random_uniform',
  random_norm: 'rt_random_norm', random_int: 'rt_random_int',
  push: 'rt_push', pop: 'rt_pop', unshift: 'rt_unshift', set: 'rt_set',
  remove_at: 'rt_remove_at', rand: 'rt_rand',
  read_file: 'rt_read_file', write_file: 'rt_write_file', clock: 'rt_clock',
  clear: 'rt_clear', sleep: 'rt_sleep', key: 'rt_key',
})) BUILTINS[n] = { c, var: false };
for (const [n, c] of Object.entries({
  print: 'rt_print', echo: 'rt_print', min: 'rt_min', max: 'rt_max', round: 'rt_round',
  morph_rewrite: 'rt_noop', morph_constant: 'rt_noop',
})) BUILTINS[n] = { c, var: true };

const BINFN = { '+': 'rt_add', '-': 'rt_sub', '*': 'rt_mul', '/': 'rt_div', '%': 'rt_mod', '**': 'rt_pow',
  '++': 'rt_cat', '>': 'rt_gt', '<': 'rt_lt', '>=': 'rt_ge', '<=': 'rt_le', '==': 'rt_eq', '!=': 'rt_ne',
  '&&': 'rt_and', 'and': 'rt_and', '||': 'rt_or', 'or': 'rt_or' };

const esc = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
const fnName = (n) => 'fn_' + n;

// ---------- name collection (function-scoped locals, like the interpreter) ----------
function namesExpr(e, acc) {
  if (!e) return;
  switch (e.type) {
    case 'Bin': namesExpr(e.l, acc); namesExpr(e.r, acc); break;
    case 'Un': namesExpr(e.e, acc); break;
    case 'Call': e.args.forEach((a) => namesExpr(a, acc)); break;
    case 'Index': namesExpr(e.obj, acc); namesExpr(e.idx, acc); break;
    case 'List': e.items.forEach((a) => namesExpr(a, acc)); break;
    case 'Prophesy': namesIn(e.body, acc); break;
    case 'Weave': namesIn(e.body, acc); break;
  }
}
function namesStmt(s, acc) {
  switch (s.type) {
    case 'Let': case 'Assign': acc.add(s.name); namesExpr(s.expr, acc); break;
    case 'ExprStmt': namesExpr(s.expr, acc); break;
    case 'If': namesExpr(s.cond, acc); namesIn(s.body, acc); if (s.alt) namesIn(s.alt, acc); break;
    case 'While': namesExpr(s.cond, acc); namesIn(s.body, acc); break;
    case 'Return': namesExpr(s.expr, acc); break;
    case 'Heal': namesIn(s.body, acc); if (s.alt) namesIn(s.alt, acc); break;
    case 'Block': namesIn(s.body, acc); break;
  }
}
function namesIn(stmts, acc) { for (const s of stmts) namesStmt(s, acc); }

// ---------- code generation ----------
function emitExpr(e) {
  switch (e.type) {
    case 'Num': return 'Value(' + e.value + ')';
    case 'Str': return 'Value(' + esc(e.value) + ')';
    case 'Bool': return 'Value(' + (e.value ? 'true' : 'false') + ')';
    case 'List': return 'Value(List{' + e.items.map(emitExpr).join(', ') + '})';
    case 'Ident': return 'v_' + e.name;
    case 'Bin': {
      const L = emitExpr(e.l), R = emitExpr(e.r);
      if (e.op === '&&' || e.op === 'and') return '([&](){ Value _a = (' + L + '); return rt_truthy(_a) ? (' + R + ') : _a; })()';
      if (e.op === '||' || e.op === 'or') return '([&](){ Value _a = (' + L + '); return rt_truthy(_a) ? _a : (' + R + '); })()';
      return BINFN[e.op] + '(' + L + ', ' + R + ')';
    }
    case 'Un': return (e.op === '-' ? 'rt_neg' : 'rt_not') + '(' + emitExpr(e.e) + ')';
    case 'Index': return 'rt_index(' + emitExpr(e.obj) + ', ' + emitExpr(e.idx) + ')';
    case 'Call': return emitCall(e);
    case 'Prophesy': return emitProphesy(e);
    case 'Weave': return emitWeave(e);
    case 'Member': throw new Error('native backend: member access (".' + e.name + '") is not supported yet');
    default: throw new Error('native backend: cannot compile expression ' + e.type);
  }
}
function emitCall(e) {
  if (e.callee.type !== 'Ident') throw new Error('native backend: only named functions can be called');
  const name = e.callee.name;
  const args = e.args.map(emitExpr);
  const b = BUILTINS[name];
  if (b) return b.var ? b.c + '(std::vector<Value>{' + args.join(', ') + '})' : b.c + '(' + args.join(', ') + ')';
  return fnName(name) + '(' + args.join(', ') + ')';
}
function emitProphesy(e) {
  const n = e.samples | 0 || 10000;
  const last = e.body[e.body.length - 1];
  const pre = e.body.slice(0, -1).map(emitStmt).join('\n');
  const sample = last && last.type === 'ExprStmt' ? emitExpr(last.expr) : 'Value(0.0)';
  return '([&](){ double _sum = 0; for (long long _s = 0; _s < ' + n + '; ++_s) { ' + pre + ' _sum += rt_num(' + sample + '); } return Value(_sum / (double)' + n + '); })()';
}
function emitWeave(e) {
  let code = '([&](){ List _l;';
  for (const s of e.body) {
    if (s.type === 'ExprStmt') code += ' _l.push_back(' + emitExpr(s.expr) + ');';
    else code += emitStmt(s) + ' _l.push_back(Value(0.0));';
  }
  return code + ' return Value(_l); })()';
}
function emitBlock(stmts) { return stmts.map(emitStmt).join('\n'); }
function emitHeal(s) {
  let code = 'try {\n' + emitBlock(s.body) + '\n} catch (RTError& _e) {';
  if (s.errName) code += ' if (_e.name == ' + esc(s.errName) + ') {\n' + (s.alt ? emitBlock(s.alt) : 'throw;') + '\n} else throw;';
  else code += '\n' + (s.alt ? emitBlock(s.alt) : 'throw;') + '\n';
  return code + ' }';
}
function emitStmt(s) {
  switch (s.type) {
    case 'Let': case 'Assign': return 'v_' + s.name + ' = ' + emitExpr(s.expr) + ';';
    case 'ExprStmt': return emitExpr(s.expr) + ';';
    case 'If': return 'if (rt_truthy(' + emitExpr(s.cond) + ')) {\n' + emitBlock(s.body) + '\n}' + (s.alt ? ' else {\n' + emitBlock(s.alt) + '\n}' : '');
    case 'While': return '{ long long _g = 0; while (rt_truthy(' + emitExpr(s.cond) + ')) { if (++_g > 100000000LL) throw RTError("loop limit exceeded");\n' + emitBlock(s.body) + '\n} }';
    case 'Return': return 'return ' + emitExpr(s.expr) + ';';
    case 'Heal': return emitHeal(s);
    case 'Block': return '{\n' + emitBlock(s.body) + '\n}';
    case 'Noop': return ';';
    case 'FuncDecl': return '';
    default: throw new Error('native backend: cannot compile statement ' + s.type);
  }
}
function emitFunction(f, globals) {
  const params = f.params;
  const locals = new Set(); namesIn(f.body, locals);
  for (const p of params) locals.delete(p);
  for (const g of (globals || new Set())) locals.delete(g);
  let code = 'Value ' + fnName(f.name) + '(' + params.map((p) => 'Value v_' + p).join(', ') + ') {\n';
  for (const nm of locals) code += '  Value v_' + nm + ';\n';
  code += emitBlock(f.body) + '\n  return Value(0.0);\n}\n';
  return code;
}
function signature(f) { return 'Value ' + fnName(f.name) + '(' + f.params.map((p) => 'Value v_' + p).join(', ') + ');\n'; }

// ---------- module loading (follows `import`) ----------
function loadModule(absPath, seen, out) {
  const ast = parse(fs.readFileSync(absPath, 'utf8'));
  const dir = path.dirname(absPath);
  for (const st of ast.body) if (st.type === 'Import') { const p = path.resolve(dir, st.path); if (!seen.has(p)) { seen.add(p); loadModule(p, seen, out); } }
  for (const st of ast.body) {
    if (st.type === 'Import') continue;
    if (st.type === 'FuncDecl') out.funcs.push(st); else out.tops.push(st);
  }
}

function compileToCpp(absPath) {
  const out = { funcs: [], tops: [] };
  loadModule(absPath, new Set([absPath]), out);

  const globals = new Set();
  for (const s of out.tops) if (s.type === 'Let' || s.type === 'Assign') globals.add(s.name);

  const funcs = out.funcs.filter((f) => f.name !== 'main');
  let code = '// Generated by morphc from Morpheus source. Do not edit by hand.\n';
  code += RT + '\n';
  for (const g of globals) code += 'Value v_' + g + ';\n';
  for (const f of funcs) code += signature(f);
  code += '\n';
  for (const f of funcs) code += emitFunction(f, globals) + '\n';

  const mainFn = out.funcs.find((f) => f.name === 'main');
  const frameFn = out.funcs.find((f) => f.name === 'frame');
  code += 'int main(int argc, char** argv) { (void)argc; (void)argv;\n';
  for (const s of out.tops) code += emitStmt(s) + '\n';
  if (mainFn) {
    const locals = new Set(); namesIn(mainFn.body, locals);
    for (const g of globals) locals.delete(g);
    for (const nm of locals) code += '  Value v_' + nm + ';\n';
    code += emitBlock(mainFn.body) + '\n';
  } else if (frameFn) {
    // host-driven app: the runtime owns the clock + keyboard, Morpheus owns the logic
    code += '  double _tick = 140;\n';
    code += '  for (;;) {\n';
    code += '    Value _st = ' + fnName('frame') + '(rt_key());\n';
    code += '    std::string _s = rt_str(_st);\n';
    code += '    if (_s == "over" || _s == "win") { std::cout << (_s == "win" ? "\\n*** YOU WIN ***\\n" : "\\n*** GAME OVER ***\\n"); break; }\n';
    code += '    rt_sleep(Value(_tick));\n';
    code += '  }\n';
  }
  code += '  return 0;\n}\n';
  return code;
}

module.exports = { compileToCpp };
