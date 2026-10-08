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
  clock: 'rt_clock', clear: 'rt_clear', sleep: 'rt_sleep', key: 'rt_key',
})) BUILTINS[n] = { c, var: false };
for (const [n, c] of Object.entries({
  print: 'rt_print', echo: 'rt_print', min: 'rt_min', max: 'rt_max', round: 'rt_round',
  morph_rewrite: 'rt_noop', morph_constant: 'rt_noop',
})) BUILTINS[n] = { c, var: true };
const BUILTIN_RET = { len: 'int', random_int: 'int', abs: 'float', sqrt: 'float', sin: 'float', cos: 'float', exp: 'float', pow: 'float', round: 'float', min: 'float', max: 'float', random_uniform: 'float', random_norm: 'float' };

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

// ---------- dynamic (Value) code generation ----------
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
  const ex = CTX.externs.get(name);
  if (ex) return cWrap(ex.returnType, name + '(' + ex.paramTypes.map((T, i) => cArg(T, emitExpr(e.args[i]))).join(', ') + ')');
  if (CTX.typed.has(name)) { const f = CTX.byName.get(name); return cWrap(f.returnType, fnName(name) + '(' + f.paramTypes.map((T, i) => cArg(T, emitExpr(e.args[i]))).join(', ') + ')'); }
  const b = BUILTINS[name];
  if (b) return b.var ? b.c + '(std::vector<Value>{' + e.args.map(emitExpr).join(', ') + '})' : b.c + '(' + e.args.map(emitExpr).join(', ') + ')';
  return fnName(name) + '(' + e.args.map(emitExpr).join(', ') + ')';
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
    case 'Let': case 'Assign': return 'v_' + s.name + ' = ' + emitExpr(s.expr) + ';';
    case 'ExprStmt': return emitExpr(s.expr) + ';';
    case 'If': return 'if (rt_truthy(' + emitExpr(s.cond) + ')) {\n' + emitBlock(s.body) + '\n}' + (s.alt ? ' else {\n' + emitBlock(s.alt) + '\n}' : '');
    case 'While': return '{ long long _g = 0; while (rt_truthy(' + emitExpr(s.cond) + ')) { if (++_g > 100000000LL) throw RTError("loop limit exceeded");\n' + emitBlock(s.body) + '\n} }';
    case 'Return': return 'return ' + emitExpr(s.expr) + ';';
    case 'Heal': return emitHeal(s);
    case 'Block': return '{\n' + emitBlock(s.body) + '\n}';
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
  code += emitBlock(f.body) + '\n  return Value(0.0);\n}\n';
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
    case 'Block': return '{\n' + emitTBlock(s.body, env, retT) + '\n}';
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
const CTX = { externs: new Map(), typed: new Set(), byName: new Map() };
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
function fullyTyped(f) {
  return f.returnType && Object.prototype.hasOwnProperty.call(CTYPE, f.returnType) &&
    f.params.every((p, i) => isScalar(f.paramTypes[i]));
}

function compileToCpp(absPath) {
  const out = { funcs: [], tops: [], externs: [] };
  loadModule(absPath, new Set([absPath]), out);
  CTX.externs = new Map(out.externs.map((e) => [e.name, e]));
  CTX.byName = new Map(out.funcs.map((f) => [f.name, f]));
  CTX.typed = new Set(out.funcs.filter(fullyTyped).map((f) => f.name));

  const globals = new Set();
  for (const s of out.tops) if (s.type === 'Let' || s.type === 'Assign') globals.add(s.name);

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
  code += 'int main(int argc, char** argv) { (void)argc; (void)argv;\n';
  for (const s of out.tops) code += emitStmt(s) + '\n';
  if (mainFn) {
    const locals = new Set(); namesIn(mainFn.body, locals);
    for (const g of globals) locals.delete(g);
    for (const nm of locals) code += '  Value v_' + nm + ';\n';
    code += emitBlock(mainFn.body) + '\n';
  } else if (frameFn) {
    code += '  double _tick = 140;\n  for (;;) {\n';
    code += '    Value _st = ' + fnName('frame') + '(rt_key());\n';
    code += '    std::string _s = rt_str(_st);\n';
    code += '    if (_s == "over" || _s == "win") { std::cout << (_s == "win" ? "\\n*** YOU WIN ***\\n" : "\\n*** GAME OVER ***\\n"); break; }\n';
    code += '    rt_sleep(Value(_tick));\n  }\n';
  }
  code += '  return 0;\n}\n';
  return code;
}

module.exports = { compileToCpp };
