/* morphc — the Morpheus native backend.
   .morph → standalone C++ (no interpreter, no VM).
   - untyped functions compile to a dynamic Value (like the reference language)
   - functions with scalar type annotations compile to real typed C++
     (int → long long, float → double, bool → bool, str → std::string)
   - `extern name(..) -> T` binds a C function (FFI), linked with -l<lib> */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('./interp.js');

const RT = fs.readFileSync(path.join(__dirname, 'runtime', 'morph_rt.h'), 'utf8');

const CTYPE = { int: 'long long', float: 'double', bool: 'bool', str: 'std::string', num: 'double', void: 'void' };
const CCTYPE = { int: 'long long', float: 'double', bool: 'bool', str: 'const char*', num: 'double', void: 'void' };
const isScalar = (t) => t && Object.prototype.hasOwnProperty.call(CTYPE, t) && t !== 'void';

const BUILTINS = {};
for (const [n, c] of Object.entries({
  len: 'rt_len', abs: 'rt_abs', sqrt: 'rt_sqrt', sin: 'rt_sin', cos: 'rt_cos', exp: 'rt_exp',
  pow: 'rt_pow', prophesy_ci: 'rt_ci', random_uniform: 'rt_random_uniform',
  random_norm: 'rt_random_norm', random_int: 'rt_random_int',
  push: 'rt_push', pop: 'rt_pop', unshift: 'rt_unshift', set: 'rt_set',
  remove_at: 'rt_remove_at', rand: 'rt_rand', read_file: 'rt_read_file', write_file: 'rt_write_file',
  clock: 'rt_clock', clear: 'rt_clear', sleep: 'rt_sleep', key: 'rt_key', arena_bytes: 'rt_arena_bytes',
})) BUILTINS[n] = { c, var: false };
for (const [n, c] of Object.entries({
  print: 'rt_print', echo: 'rt_print', min: 'rt_min', max: 'rt_max', round: 'rt_round',
  morph_rewrite: 'rt_noop', morph_constant: 'rt_noop', input: 'rt_noop',
  type: 'rt_type', int: 'rt_toint', float: 'rt_tofloat', str: 'rt_tostr',
  floor: 'rt_floor', ceil: 'rt_ceil', tan: 'rt_tan', log: 'rt_log',
  upper: 'rt_upper', lower: 'rt_lower', trim: 'rt_trim', split: 'rt_split', join: 'rt_join',
  contains: 'rt_contains', index_of: 'rt_index_of', substr: 'rt_substr', replace: 'rt_replace',
  starts_with: 'rt_starts_with', ends_with: 'rt_ends_with', repeat: 'rt_repeat',
  shift: 'rt_shift', insert: 'rt_insert', remove: 'rt_remove', reverse: 'rt_reverse', sort: 'rt_sort',
  range: 'rt_range', sum: 'rt_sum', min_of: 'rt_min_of', max_of: 'rt_max_of',
  keys: 'rt_keys', values: 'rt_values', has: 'rt_has', get: 'rt_get', put: 'rt_put', del: 'rt_del',
})) BUILTINS[n] = { c, var: true };
const BUILTIN_RET = { arena_bytes: 'float', len: 'int', random_int: 'int', abs: 'float', sqrt: 'float', sin: 'float', cos: 'float', exp: 'float', pow: 'float', round: 'float', min: 'float', max: 'float', random_uniform: 'float', random_norm: 'float',
  type: 'str', int: 'int', str: 'str', floor: 'float', ceil: 'float', tan: 'float', log: 'float',
  upper: 'str', lower: 'str', trim: 'str', substr: 'str', replace: 'str', join: 'str',
  contains: 'bool', has: 'bool', starts_with: 'bool', ends_with: 'bool', index_of: 'int', sum: 'float' };

const BINFN = { '+': 'rt_add', '-': 'rt_sub', '*': 'rt_mul', '/': 'rt_div', '%': 'rt_mod', '**': 'rt_pow',
  '++': 'rt_cat', '>': 'rt_gt', '<': 'rt_lt', '>=': 'rt_ge', '<=': 'rt_le', '==': 'rt_eq', '!=': 'rt_ne' };

const esc = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
const fnName = (n) => 'fn_' + n;

// ---------- name collection ----------
function namesExpr(e, acc) {
  if (!e) return;
  switch (e.type) {
    case 'Bin': namesExpr(e.l, acc); namesExpr(e.r, acc); break;
    case 'Un': namesExpr(e.e, acc); break;
    case 'Call': e.args.forEach((a) => namesExpr(a, acc)); break;
    case 'Index': namesExpr(e.obj, acc); namesExpr(e.idx, acc); break;
    case 'Member': namesExpr(e.obj, acc); break;
    case 'List': e.items.forEach((a) => namesExpr(a, acc)); break;
    case 'Cond': namesExpr(e.cond, acc); namesExpr(e.then, acc); namesExpr(e.els, acc); break;
    case 'Range': namesExpr(e.a, acc); namesExpr(e.b, acc); break;
    case 'Map': e.pairs.forEach((p) => { namesExpr(p.key, acc); namesExpr(p.value, acc); }); break;
    case 'Slice': namesExpr(e.obj, acc); if (e.start) namesExpr(e.start, acc); if (e.end) namesExpr(e.end, acc); break;
    case 'Prophesy': namesIn(e.body, acc); break;
    case 'Weave': namesIn(e.body, acc); break;
    case 'Lambda': break;
  }
}
function declaredNames(stmts, acc) {
  for (const s of stmts) switch (s.type) {
    case 'Let': acc.add(s.name); break;
    case 'Assign': if (s.target.type === 'Ident') acc.add(s.target.name); break;
    case 'ForIn': acc.add(s.name); declaredNames(s.body, acc); break;
    case 'If': declaredNames(s.body, acc); if (s.alt) declaredNames(s.alt, acc); break;
    case 'While': declaredNames(s.body, acc); break;
    case 'Heal': declaredNames(s.body, acc); if (s.alt) declaredNames(s.alt, acc); break;
    case 'Block': case 'Arena': declaredNames(s.body, acc); break;
  }
}
function namesStmt(s, acc) {
  switch (s.type) {
    case 'Let': acc.add(s.name); namesExpr(s.expr, acc); break;
    case 'TypeDecl': break;
    case 'Assign': if (s.target.type === 'Ident') acc.add(s.target.name); else namesExpr(s.target, acc); namesExpr(s.expr, acc); break;
    case 'ExprStmt': namesExpr(s.expr, acc); break;
    case 'If': namesExpr(s.cond, acc); namesIn(s.body, acc); if (s.alt) namesIn(s.alt, acc); break;
    case 'While': namesExpr(s.cond, acc); namesIn(s.body, acc); break;
    case 'ForIn': acc.add(s.name); if (s.name2) acc.add(s.name2); namesExpr(s.iter, acc); namesIn(s.body, acc); break;
    case 'Break': case 'Continue': break;
    case 'Return': namesExpr(s.expr, acc); break;
    case 'Heal': namesIn(s.body, acc); if (s.alt) namesIn(s.alt, acc); break;
    case 'Block': namesIn(s.body, acc); break;
    case 'Arena': namesIn(s.body, acc); break;
  }
}
function namesIn(stmts, acc) { for (const s of stmts) namesStmt(s, acc); }

// ---------- dynamic (Value) code generation ----------
function emitExpr(e) {
  switch (e.type) {
    case 'Num': return 'Value((double)' + e.value + ')';
    case 'Str': return 'Value(' + esc(e.value) + ')';
    case 'Bool': return 'Value(' + (e.value ? 'true' : 'false') + ')';
    case 'List': { const inner = 'List{' + e.items.map(emitExpr).join(', ') + '}'; return (CTX.arena > 0 ? 'rt_arena_list(' + inner + ')' : 'Value(' + inner + ')'); }
    case 'Ident': return 'v_' + e.name;
    case 'Bin': {
      const L = emitExpr(e.l), R = emitExpr(e.r);
      if (e.op === '&&' || e.op === 'and') return '([&](){ Value _a = (' + L + '); return rt_truthy(_a) ? (' + R + ') : _a; })()';
      if (e.op === '||' || e.op === 'or') return '([&](){ Value _a = (' + L + '); return rt_truthy(_a) ? _a : (' + R + '); })()';
      return BINFN[e.op] + '(' + L + ', ' + R + ')';
    }
    case 'Un': return (e.op === '-' ? 'rt_neg' : 'rt_not') + '(' + emitExpr(e.e) + ')';
    case 'Index': return 'rt_index(' + emitExpr(e.obj) + ', ' + emitExpr(e.idx) + ')';
    case 'Member': return 'rt_index(' + emitExpr(e.obj) + ', Value(' + esc(e.name) + '))';
    case 'Range': return 'rt_range(std::vector<Value>{' + emitExpr(e.a) + ', ' + emitExpr(e.b) + '})';
    case 'Map': { const parts = []; for (const p of e.pairs) { parts.push(emitExpr(p.key)); parts.push(emitExpr(p.value)); } return 'rt_map(std::vector<Value>{' + parts.join(', ') + '})'; }
    case 'Slice': { const o = emitExpr(e.obj); const a = e.start ? '(long long)rt_num(' + emitExpr(e.start) + ')' : '0'; return '([&](){ Value _o = ' + o + '; long long _a = ' + a + '; long long _n = (_o.k == Value::STR ? (long long)_o.s.size() : (long long)_o.l->size()); long long _b = ' + (e.end ? '(long long)rt_num(' + emitExpr(e.end) + ')' : '_n') + '; if (_b < _a) _b = _a; if (_b > _n) _b = _n; if (_o.k == Value::STR) return Value(_o.s.substr(_a, _b - _a)); List _l(_o.l->begin() + _a, _o.l->begin() + _b); return Value(_l); })()'; }
    case 'Cond': return '([&](){ return rt_truthy(' + emitExpr(e.cond) + ') ? (' + emitExpr(e.then) + ') : (' + emitExpr(e.els) + '); })()';
    case 'Lambda': { const dn = new Set(); declaredNames(e.body, dn); for (const p of e.params) dn.delete(p);
      const locals = [...dn].filter((n) => !CTX.scope.has(n));
      const localDecls = locals.map((n) => 'Value v_' + n + ';').join(' ');
      const binds = e.params.map((p, i) => 'Value v_' + p + ' = (_a.size() > ' + i + ' ? _a[' + i + '] : Value(0.0));').join(' ');
      const saveM = CTX.mainEntry; CTX.mainEntry = false;
      const prevScope = CTX.scope; CTX.scope = new Set([...prevScope, ...e.params, ...locals]);
      const bodyStr = emitBlock(e.body);
      CTX.scope = prevScope; CTX.mainEntry = saveM;
      return 'Value(std::make_shared<FnT>([=](std::vector<Value> _a) mutable -> Value {\n' + binds + '\n' + localDecls + '\n' + bodyStr + '\nreturn Value(0.0); }))'; }
    case 'Call': return emitCall(e);
    case 'Prophesy': return emitProphesy(e);
    case 'Weave': return emitWeave(e);
    default: throw new Error('native backend: cannot compile expression ' + e.type);
  }
}
function emitCall(e) {
  if (e.callee.type === 'Member') {
    const b = BUILTINS[e.callee.name];
    if (!b) throw new Error('native backend: unknown method .' + e.callee.name);
    const all = [emitExpr(e.callee.obj)].concat(e.args.map(emitExpr));
    return b.var ? b.c + '(std::vector<Value>{' + all.join(', ') + '})' : b.c + '(' + all.join(', ') + ')';
  }
  if (e.callee.type !== 'Ident') return 'rt_call(' + emitExpr(e.callee) + ', std::vector<Value>{' + e.args.map(emitExpr).join(', ') + '})';
  const name = e.callee.name;
  if (CTX.types.has(name)) { const parts = []; CTX.types.get(name).forEach((f, i) => { parts.push('Value(' + esc(f) + ')'); parts.push(emitExpr(e.args[i] || { type: 'Num', value: 0 })); }); return 'rt_map(std::vector<Value>{' + parts.join(', ') + '})'; }
  const ex = CTX.externs.get(name);
  if (ex) return cWrap(ex.returnType, name + '(' + ex.paramTypes.map((T, i) => cArg(T, emitExpr(e.args[i]))).join(', ') + ')');
  if (CTX.typed.has(name)) { const f = CTX.byName.get(name); return cWrap(f.returnType, fnName(name) + '(' + f.paramTypes.map((T, i) => cArg(T, emitExpr(e.args[i]))).join(', ') + ')'); }
  const b = BUILTINS[name];
  if (b) return b.var ? b.c + '(std::vector<Value>{' + e.args.map(emitExpr).join(', ') + '})' : b.c + '(' + e.args.map(emitExpr).join(', ') + ')';
  if (CTX.byName.has(name)) return fnName(name) + '(' + e.args.map(emitExpr).join(', ') + ')';
  return 'rt_call(v_' + name + ', std::vector<Value>{' + e.args.map(emitExpr).join(', ') + '})';
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
  for (const s of e.body) code += s.type === 'ExprStmt' ? ' _l.push_back(' + emitExpr(s.expr) + ');' : ' ' + emitStmt(s) + ' _l.push_back(Value(0.0));';
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
    case 'Let': return 'v_' + s.name + ' = ' + emitExpr(s.expr) + ';';
    case 'TypeDecl': CTX.types.set(s.name, s.fields); return '';
    case 'Assign': { const v = emitExpr(s.expr);
      if (s.target.type === 'Ident') return 'v_' + s.target.name + ' = ' + v + ';';
      if (s.target.type === 'Member') return 'rt_set_index(' + emitExpr(s.target.obj) + ', Value(' + esc(s.target.name) + '), ' + v + ');';
      return 'rt_set_index(' + emitExpr(s.target.obj) + ', ' + emitExpr(s.target.idx) + ', ' + v + ');'; }
    case 'ExprStmt': return emitExpr(s.expr) + ';';
    case 'If': return 'if (rt_truthy(' + emitExpr(s.cond) + ')) {\n' + emitBlock(s.body) + '\n}' + (s.alt ? ' else {\n' + emitBlock(s.alt) + '\n}' : '');
    case 'While': return '{ long long _g = 0; while (rt_truthy(' + emitExpr(s.cond) + ')) { if (++_g > 100000000LL) throw RTError("loop limit exceeded");\n' + emitBlock(s.body) + '\n} }';
    case 'Return': return CTX.mainEntry ? 'return (int)rt_num(' + emitExpr(s.expr) + ');' : 'return ' + emitExpr(s.expr) + ';';
    case 'Heal': return emitHeal(s);
    case 'Block': return '{\n' + emitBlock(s.body) + '\n}';
    case 'Arena': { CTX.arena = (CTX.arena || 0) + 1; const ab = emitBlock(s.body); CTX.arena--; return '{ RtArena _ar;\n' + ab + '\n}'; }
    case 'ForIn': { CTX.forN = (CTX.forN || 0) + 1; const it = '_it' + CTX.forN; const body = emitBlock(s.body);
      if (s.name2) return '{ Value ' + it + ' = ' + emitExpr(s.iter) + '; if (' + it + '.k == Value::MAP) { for (auto& _kv : *' + it + '.m) { v_' + s.name + ' = Value(_kv.first); v_' + s.name2 + ' = _kv.second;\n' + body + '\n} } else if (' + it + '.k == Value::STR) { for (size_t _i = 0; _i < ' + it + '.s.size(); ++_i) { v_' + s.name + ' = Value((double)_i); v_' + s.name2 + ' = Value(std::string(1, ' + it + '.s[_i]));\n' + body + '\n} } else { for (size_t _i = 0; _i < ' + it + '.l->size(); ++_i) { v_' + s.name + ' = Value((double)_i); v_' + s.name2 + ' = (*' + it + '.l)[_i];\n' + body + '\n} } }';
      return '{ Value ' + it + ' = ' + emitExpr(s.iter) + '; if (' + it + '.k == Value::STR) { for (char _c : ' + it + '.s) { v_' + s.name + ' = Value(std::string(1, _c));\n' + body + '\n} } else { for (size_t _i = 0; _i < ' + it + '.l->size(); ++_i) { v_' + s.name + ' = (*' + it + '.l)[_i];\n' + body + '\n} } }'; }
    case 'Break': return 'break;';
    case 'Continue': return 'continue;';
    case 'Noop': return ';';
    case 'FuncDecl': case 'Extern': return '';
    default: throw new Error('native backend: cannot compile statement ' + s.type);
  }
}
function emitFunction(f, globals) {
  const locals = new Set(); namesIn(f.body, locals);
  for (const p of f.params) locals.delete(p);
  for (const g of globals) locals.delete(g);
  let code = 'Value ' + fnName(f.name) + '(' + f.params.map((p) => 'Value v_' + p).join(', ') + ') {\n';
  for (const nm of locals) code += '  Value v_' + nm + ';\n';
  const prev = CTX.scope; CTX.scope = new Set([...globals, ...f.params, ...locals]);
  code += emitBlock(f.body) + '\n  return Value(0.0);\n}\n';
  CTX.scope = prev;
  return code;
}
function signature(f) { return 'Value ' + fnName(f.name) + '(' + f.params.map((p) => 'Value v_' + p).join(', ') + ');\n'; }

// ---------- typed (scalar) code generation ----------
function inferT(e, env) {
  switch (e.type) {
    case 'Num': return Number.isInteger(e.value) ? 'int' : 'float';
    case 'Str': return 'str';
    case 'Bool': return 'bool';
    case 'Ident': if (env[e.name]) return env[e.name]; throw new Error('typed backend: unknown variable ' + e.name);
    case 'Bin': {
      if (e.op === '++') return 'str';
      if (['>', '<', '>=', '<=', '==', '!=', '&&', 'and', '||', 'or'].includes(e.op)) return 'bool';
      const a = inferT(e.l, env), b = inferT(e.r, env);
      if (e.op === '/') return 'float';
      return (a === 'int' && b === 'int') ? 'int' : 'float';
    }
    case 'Un': return e.op === '-' ? inferT(e.e, env) : 'bool';
    case 'Call': return callReturnT(e, env);
    default: throw new Error('typed backend: unsupported expression ' + e.type);
  }
}
function callReturnT(e, env) {
  const name = e.callee.name;
  const ex = CTX.externs.get(name); if (ex) return ex.returnType === 'void' ? 'void' : (ex.returnType || 'float');
  if (CTX.typed.has(name)) return CTX.byName.get(name).returnType;
  if (BUILTINS[name]) return BUILTIN_RET[name] || 'float';
  throw new Error('typed backend: unknown function ' + name);
}
function emitTBin(e, env) {
  const L = () => emitTExpr(e.l, env), R = () => emitTExpr(e.r, env);
  if (e.op === '++') return '(' + L() + ' + ' + R() + ')';
  if (['>', '<', '>=', '<=', '==', '!='].includes(e.op)) return '(' + L() + ' ' + e.op + ' ' + R() + ')';
  if (e.op === '&&' || e.op === 'and') return '(' + L() + ' && ' + R() + ')';
  if (e.op === '||' || e.op === 'or') return '(' + L() + ' || ' + R() + ')';
  if (e.op === '/') return '((double)(' + L() + ') / (double)(' + R() + '))';
  if (e.op === '%') return '((long long)(' + L() + ') % (long long)(' + R() + '))';
  if (e.op === '**') return 'std::pow((double)(' + L() + '), (double)(' + R() + '))';
  if (inferT(e.l, env) === 'int' && inferT(e.r, env) === 'int') return '(' + L() + ' ' + e.op + ' ' + R() + ')';
  return '((double)(' + L() + ') ' + e.op + ' (double)(' + R() + '))';
}
function emitTCall(e, env) {
  const name = e.callee.name;
  const ex = CTX.externs.get(name);
  if (ex) {
    const call = name + '(' + ex.paramTypes.map((T, i) => TValToC(T, emitTExpr(e.args[i], env))).join(', ') + ')';
    if (ex.returnType === 'void') return '([&](){ ' + call + '; return 0.0; })()';
    if (ex.returnType === 'str') return 'std::string(' + call + ')';
    return call;
  }
  if (CTX.typed.has(name)) {
    const f = CTX.byName.get(name);
    const call = fnName(name) + '(' + f.paramTypes.map((T, i) => emitTExpr(e.args[i], env)).join(', ') + ')';
    return f.returnType === 'void' ? '([&](){ ' + call + '; return 0.0; })()' : call;
  }
  const b = BUILTINS[name];
  if (b) {
    const wrap = (a) => 'Value(' + emitTExpr(a, env) + ')';
    const raw = b.var ? b.c + '(std::vector<Value>{' + e.args.map(wrap).join(', ') + '})' : b.c + '(' + e.args.map(wrap).join(', ') + ')';
    if (name === 'print' || name === 'echo') return '([&](){ ' + raw + '; return 0.0; })()';
    return (BUILTIN_RET[name] === 'int') ? '(long long)rt_num(' + raw + ')' : 'rt_num(' + raw + ')';
  }
  throw new Error('typed backend: unknown function ' + name);
}
function emitTExpr(e, env) {
  switch (e.type) {
    case 'Num': return Number.isInteger(e.value) ? '((long long)' + e.value + ')' : '(' + e.value + ')';
    case 'Str': return esc(e.value);
    case 'Bool': return e.value ? 'true' : 'false';
    case 'Ident': return 'v_' + e.name;
    case 'Un': return e.op === '-' ? '(-(' + emitTExpr(e.e, env) + '))' : '(!(' + emitTExpr(e.e, env) + '))';
    case 'Bin': return emitTBin(e, env);
    case 'Cond': return '([&](){ return (' + emitTExpr(e.cond, env) + ') ? (' + emitTExpr(e.then, env) + ') : (' + emitTExpr(e.els, env) + '); })()';
    case 'Call': return emitTCall(e, env);
    default: throw new Error('typed backend: unsupported expression ' + e.type);
  }
}
function emitTStmt(s, env, retT) {
  switch (s.type) {
    case 'Let': case 'Assign': if (!env[s.name]) env[s.name] = s.typeName || inferT(s.expr, env); return 'v_' + s.name + ' = ' + emitTExpr(s.expr, env) + ';';
    case 'ExprStmt': { const t = inferT(s.expr, env); const code = emitTExpr(s.expr, env); return t === 'void' ? code + ';' : '(void)(' + code + ');'; }
    case 'If': return 'if (' + emitTExpr(s.cond, env) + ') {\n' + emitTBlock(s.body, env, retT) + '\n}' + (s.alt ? ' else {\n' + emitTBlock(s.alt, env, retT) + '\n}' : '');
    case 'While': return '{ long long _g = 0; while (' + emitTExpr(s.cond, env) + ') { if (++_g > 100000000LL) throw RTError("loop limit exceeded");\n' + emitTBlock(s.body, env, retT) + '\n} }';
    case 'Return': return retT === 'void' ? 'return;' : 'return ' + emitTExpr(s.expr, env) + ';';
    case 'Block': case 'Arena': return '{\n' + emitTBlock(s.body, env, retT) + '\n}';
    case 'Break': return 'break;';
    case 'Continue': return 'continue;';
    case 'Noop': return ';';
    default: throw new Error('typed backend: unsupported statement ' + s.type);
  }
}
function emitTBlock(stmts, env, retT) { return stmts.map((s) => emitTStmt(s, env, retT)).join('\n'); }
function collectEnv(stmts, env) {
  for (const s of stmts) {
    if (s.type === 'Let' || s.type === 'Assign') { if (!env[s.name]) { try { env[s.name] = s.typeName || inferT(s.expr, env); } catch (e) { env[s.name] = 'float'; } } }
    if (s.type === 'If') { collectEnv(s.body, env); if (s.alt) collectEnv(s.alt, env); }
    if (s.type === 'While' || s.type === 'Block') collectEnv(s.body, env);
    if (s.type === 'Heal') { collectEnv(s.body, env); if (s.alt) collectEnv(s.alt, env); }
  }
}
function defaultValue(t) { return t === 'int' ? '0' : t === 'float' ? '0.0' : t === 'bool' ? 'false' : t === 'str' ? 'std::string()' : '0'; }
function emitTypedFunction(f) {
  const env = {};
  f.params.forEach((p, i) => env[p] = f.paramTypes[i]);
  collectEnv(f.body, env);
  let code = CTYPE[f.returnType] + ' ' + fnName(f.name) + '(' + f.params.map((p, i) => CTYPE[f.paramTypes[i]] + ' v_' + p).join(', ') + ') {\n';
  for (const nm of Object.keys(env)) if (!f.params.includes(nm)) code += '  ' + CTYPE[env[nm]] + ' v_' + nm + ';\n';
  code += emitTBlock(f.body, env, f.returnType) + '\n';
  if (f.returnType !== 'void') code += '  return ' + defaultValue(f.returnType) + ';\n';
  return code + '}\n';
}
function typedSignature(f) { return CTYPE[f.returnType] + ' ' + fnName(f.name) + '(' + f.params.map((p, i) => CTYPE[f.paramTypes[i]] + ' v_' + p).join(', ') + ');\n'; }

// ---------- boundary conversions ----------
function cArg(T, vexpr) {
  switch (T) {
    case 'str': return 'rt_str(' + vexpr + ').c_str()';
    case 'int': return '(long long)rt_num(' + vexpr + ')';
    case 'bool': return 'rt_truthy(' + vexpr + ')';
    default: return 'rt_num(' + vexpr + ')';
  }
}
function cWrap(R, call) { if (R === 'void') return '([&](){ ' + call + '; return Value(0.0); })()'; if (R === 'str') return 'Value(std::string(' + call + '))'; return 'Value(' + call + ')'; }
function TValToC(T, code) { return T === 'str' ? code + '.c_str()' : code; }

// ---------- module loading ----------
const CTX = { externs: new Map(), typed: new Set(), byName: new Map(), types: new Map(), arena: 0, scope: new Set() };
function loadModule(absPath, seen, out) {
  const ast = parse(fs.readFileSync(absPath, 'utf8'));
  const dir = path.dirname(absPath);
  for (const st of ast.body) if (st.type === 'Import') { const p = path.resolve(dir, st.path); if (!seen.has(p)) { seen.add(p); loadModule(p, seen, out); } }
  for (const st of ast.body) {
    if (st.type === 'Import') continue;
    if (st.type === 'FuncDecl') out.funcs.push(st);
    else if (st.type === 'Extern') out.externs.push(st);
    else out.tops.push(st);
  }
}
const TYPED_UNSUPPORTED = new Set(['ForIn', 'List', 'Index', 'Map', 'Range', 'Slice', 'Member', 'Lambda', 'Prophesy', 'Weave', 'Import', 'TypeDecl', 'Heal']);
function findUnsupportedTyped(node) {           // conservative: if ANY unsupported node appears, not typed
  let bad = false;
  (function rec(n) {
    if (bad || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) rec(x); return; }
    if (n.type && TYPED_UNSUPPORTED.has(n.type)) { bad = true; return; }
    if (n.type === 'Assign' && n.target && n.target.type !== 'Ident') { bad = true; return; }
    for (const k in n) rec(n[k]);
  })(node);
  return bad;
}
function fullyTyped(f) {
  if (!(f.returnType && Object.prototype.hasOwnProperty.call(CTYPE, f.returnType) && f.params.every((p, i) => isScalar(f.paramTypes[i])))) return false;
  return !findUnsupportedTyped(f.body);   // graceful: fall back to dynamic instead of erroring
}

function compileToCpp(absPath) {
  const out = { funcs: [], tops: [], externs: [] };
  loadModule(absPath, new Set([absPath]), out);
  CTX.externs = new Map(out.externs.map((e) => [e.name, e]));
  CTX.byName = new Map(out.funcs.map((f) => [f.name, f]));
  CTX.typed = new Set(out.funcs.filter(fullyTyped).map((f) => f.name));
  CTX.types = new Map();
  for (const s of out.tops) if (s.type === 'TypeDecl') CTX.types.set(s.name, s.fields);

  const globals = new Set();
  for (const s of out.tops) { if (s.type === 'Let') globals.add(s.name); else if (s.type === 'Assign' && s.target.type === 'Ident') globals.add(s.target.name); }

  const funcs = out.funcs.filter((f) => f.name !== 'main');
  let code = '// Generated by morphc from Morpheus source. Do not edit by hand.\n';
  code += RT + '\n';
  for (const ex of out.externs) code += 'extern "C" ' + CCTYPE[ex.returnType || 'float'] + ' ' + ex.name + '(' + ex.paramTypes.map((T, i) => CCTYPE[T || 'float'] + ' ' + ex.params[i]).join(', ') + ');\n';
  for (const g of globals) code += 'Value v_' + g + ';\n';
  for (const f of funcs) code += CTX.typed.has(f.name) ? typedSignature(f) : signature(f);
  code += '\n';
  for (const f of funcs) code += CTX.typed.has(f.name) ? emitTypedFunction(f) : emitFunction(f, globals);

  const mainFn = out.funcs.find((f) => f.name === 'main');
  const frameFn = out.funcs.find((f) => f.name === 'frame');
  code += 'int main(int argc, char** argv) { (void)argc; (void)argv;\n  try {\n';
  for (const s of out.tops) code += emitStmt(s) + '\n';
  if (mainFn) {
    const locals = new Set(); namesIn(mainFn.body, locals);
    for (const g of globals) locals.delete(g);
    if (mainFn.params.length) { locals.delete(mainFn.params[0]); code += '  Value v_' + mainFn.params[0] + ' = rt_args(argc, argv);\n'; }
    for (const nm of locals) code += '  Value v_' + nm + ';\n';
    CTX.mainEntry = true;
    const prevScope = CTX.scope; CTX.scope = new Set([...globals, ...locals, ...mainFn.params]);
    code += emitBlock(mainFn.body) + '\n';
    CTX.scope = prevScope; CTX.mainEntry = false;
  } else if (frameFn) {
    code += '  double _tick = 140;\n  for (;;) {\n';
    code += '    Value _st = ' + fnName('frame') + '(rt_key());\n';
    code += '    std::string _s = rt_str(_st);\n';
    code += '    if (_s == "over" || _s == "win") { std::cout << (_s == "win" ? "\\n*** YOU WIN ***\\n" : "\\n*** GAME OVER ***\\n"); break; }\n';
    code += '    rt_sleep(Value(_tick));\n  }\n';
  }
  code += '  } catch (const std::exception& e) { std::cout << "Error: " << e.what() << std::endl; return 1; }\n';
  code += '  return 0;\n}\n';
  return code;
}

module.exports = { compileToCpp };
