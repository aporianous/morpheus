/* Morpheus (teaching subset) — a small interpreter for the learn-Morpheus demo.
   This is a browser/Node reimplementation of the LANGUAGE SURFACE only
   Zero dependencies. */
(function (root) {
  'use strict';

  // ---------- tokenizer ----------
  const OPS = ['**', '>=', '<=', '==', '!=', '&&', '||', '++', '->'];
  const KW = new Set(['vision','sovereign','when','dream','signal','morph','heal','prophesy','weave','whisper','loop','from','import','with','samples','confidence','on','true','false','let','and','or','not','extern','arena']);

  function tokenize(src) {
    const t = [];
    let i = 0, line = 1;
    const push = (type, value) => t.push({ type, value, line });
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      // comments
      if (c === '#' || (c === '/' && src[i+1] === '/')) { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.startsWith('whisper', i) && !/[\w$]/.test(src[i+7] || '')) { while (i < src.length && src[i] !== '\n') i++; continue; }
      // strings
      if (c === '"' || c === "'") {
        const q = c; i++; let s = '';
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\') { const n = src[i+1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n; i += 2; }
          else { s += src[i]; i++; }
        }
        i++; push('str', s); continue;
      }
      // numbers
      if (/[0-9]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; push('num', parseFloat(src.slice(i, j))); i = j; continue; }
      // identifiers / keywords
      if (/[A-Za-z_$]/.test(c)) {
        let j = i; while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
        const w = src.slice(i, j); push(KW.has(w) ? 'kw' : 'ident', w); i = j; continue;
      }
      // unicode + multi-char ops
      const two = src.slice(i, i + 2);
      if (OPS.includes(two)) { push('op', two); i += 2; continue; }
      const map = { '\u2190': '=', '\u226B': '>', '\u226A': '<' };
      if (map[c]) { push('op', map[c]); i++; continue; }
      if ('+-*/%<>=!.,;:'.includes(c)) { push('op', c); i++; continue; }
      if ('(){}[]'.includes(c)) { push('punct', c); i++; continue; }
      throw new Error('line ' + line + ': unexpected character ' + JSON.stringify(c));
    }
    push('eof', null);
    return t;
  }

  // ---------- parser ----------
  function parse(src) {
    const t = tokenize(src);
    let p = 0;
    const peek = () => t[p];
    const next = () => t[p++];
    const isKw = (k) => t[p].type === 'kw' && t[p].value === k;
    const isOp = (o) => t[p].type === 'op' && t[p].value === o;
    const isP = (c) => t[p].type === 'punct' && t[p].value === c;
    const eat = (c) => { if (!isP(c)) throw new Error('expected ' + c + ' but got ' + JSON.stringify(t[p].value)); p++; };
    const eatOp = (o) => { if (!isOp(o)) throw new Error('expected ' + o + ' but got ' + JSON.stringify(t[p].value)); p++; };

    function program() { const body = []; while (peek().type !== 'eof') body.push(statement()); return { type: 'Program', body }; }
    function block() { eat('{'); const body = []; while (!isP('}')) body.push(statement()); eat('}'); return body; }

    function statement() {
      if (isKw('sovereign')) return funcDecl();
      if (isKw('extern')) return externDecl();
      if (isKw('let')) { next(); const name = next().value; let typeName = null; if (isOp(':')) { next(); typeName = next().value; } eatOp('='); return { type: 'Let', name, expr: expression(), typeName }; }
      if (isKw('when')) return ifStmt();
      if (isKw('loop')) { next(); const cond = expression(); return { type: 'While', cond, body: block() }; }
      if (isKw('signal')) { next(); return { type: 'Return', expr: expression() }; }
      if (isKw('heal')) return healStmt();
      if (isKw('from')) return fromStmt();
      if (isKw('import')) return importStmt();
      if (isKw('vision')) { next(); next(); return { type: 'Noop' }; }
      if (isKw('morph')) return { type: 'Block', body: block() };
      if (isKw('arena')) { next(); return { type: 'Arena', body: block() }; }
      // assignment vs bare expression
      if (peek().type === 'ident' && t[p+1] && t[p+1].type === 'op' && t[p+1].value === '=') {
        const name = next().value; eatOp('='); return { type: 'Assign', name, expr: expression() };
      }
      return { type: 'ExprStmt', expr: expression() };
    }
    function paramList() { const params = [], paramTypes = []; eat('(');
      while (!isP(')')) { const pn = next().value; let pt = null; if (isOp(':')) { next(); pt = next().value; } params.push(pn); paramTypes.push(pt); if (isOp(',')) next(); }
      eat(')'); return { params, paramTypes };
    }
    function funcDecl() { next(); const name = next().value; const { params, paramTypes } = paramList();
      let returnType = null; if (isOp('->')) { next(); returnType = next().value; }
      return { type: 'FuncDecl', name, params, paramTypes, returnType, body: block() };
    }
    function externDecl() { next(); const name = next().value; const { params, paramTypes } = paramList();
      let returnType = null; if (isOp('->')) { next(); returnType = next().value; }
      return { type: 'Extern', name, params, paramTypes, returnType };
    }
    function ifStmt() { next(); const cond = expression(); const body = block();
      let alt = null; if (isKw('dream')) { next(); alt = block(); } return { type: 'If', cond, body, alt };
    }
    function healStmt() { next();
      let errName = null;
      if (isKw('on')) { next(); errName = next().value; }
      const body = block(); let alt = null; if (isKw('dream')) { next(); alt = block(); }
      return { type: 'Heal', errName, body, alt };
    }
    function fromStmt() { next(); next(); next(); next(); return { type: 'Noop' }; } // `from python import x` -> noop in the browser demo
    function importStmt() { next(); const tok = peek(); if (tok.type !== 'str') throw new Error('import expects a file path string'); next(); return { type: 'Import', path: tok.value }; }

    function expression() { return orE(); }
    function bin(left, ops, rhs) { let node = left(); while ((peek().type === 'op' || peek().type === 'kw') && ops.includes(peek().value)) { const op = next().value; node = { type: 'Bin', op, l: node, r: rhs() }; } return node; }
    function orE() { return bin(andE, ['||', 'or'], orRHS); }
    function andE() { return bin(eqE, ['&&', 'and'], andRHS); }
    function eqE() { return bin(cmpE, ['==', '!='], eqRHS); }
    function cmpE() { return bin(addE, ['>', '<', '>=', '<='], cmpRHS); }
    function addE() { return bin(mulE, ['+', '-', '++'], addRHS); }
    function mulE() { return bin(powE, ['*', '/', '%'], mulRHS); }
    function powE() { return bin(unary, ['**'], powRHS); }
    function orRHS() { return andE(); } function andRHS() { return eqE(); } function eqRHS() { return cmpE(); }
    function cmpRHS() { return addE(); } function addRHS() { return mulE(); } function mulRHS() { return powE(); } function powRHS() { return unary(); }
    function unary() { if (isOp('!') || isKw('not')) { next(); return { type: 'Un', op: '!', e: unary() }; } if (isOp('-')) { next(); return { type: 'Un', op: '-', e: unary() }; } return postfix(); }
    function postfix() {
      let node = primary();
      for (;;) {
        if (isP('(')) { next(); const args = []; while (!isP(')')) { args.push(expression()); if (isOp(',')) next(); } eat(')'); node = { type: 'Call', callee: node, args }; }
        else if (isOp('.')) { next(); const name = next().value; node = { type: 'Member', obj: node, name }; }
        else if (isP('[')) { next(); const idx = expression(); eat(']'); node = { type: 'Index', obj: node, idx }; }
        else break;
      }
      return node;
    }
    function primary() {
      const tok = peek();
      if (tok.type === 'num') { next(); return { type: 'Num', value: tok.value }; }
      if (tok.type === 'str') { next(); return { type: 'Str', value: tok.value }; }
      if (tok.type === 'kw' && tok.value === 'true') { next(); return { type: 'Bool', value: true }; }
      if (tok.type === 'kw' && tok.value === 'false') { next(); return { type: 'Bool', value: false }; }
      if (tok.type === 'kw' && tok.value === 'prophesy') return prophesy();
      if (tok.type === 'kw' && tok.value === 'weave') { next(); return { type: 'Weave', body: block() }; }
      if (tok.type === 'ident') { next(); return { type: 'Ident', name: tok.value }; }
      if (isP('(')) { next(); const e = expression(); eat(')'); return e; }
      if (isP('[')) { next(); const items = []; while (!isP(']')) { items.push(expression()); if (isOp(',')) next(); } eat(']'); return { type: 'List', items }; }
      throw new Error('line ' + tok.line + ': unexpected token ' + JSON.stringify(tok.value));
    }
    function prophesy() { next();
      const body = block();
      let samples = 10000, confidence = 0.95;
      if (isKw('with')) { next();
        while (isKw('samples') || isKw('confidence') || isOp(',')) {
          if (isOp(',')) { next(); continue; }
          const k = next().value; eatOp(':'); const v = expression();
          if (k === 'samples') samples = v.value;
          if (k === 'confidence') confidence = v.value;
        }
      }
      return { type: 'Prophesy', body, samples, confidence };
    }
    // prophesy `with` values are literals; grab them directly
    // (the generic expression() above handles `5000` / `0.95` fine)
    return program();
  }

  // ---------- interpreter ----------
  const RET = Symbol('return');
  function runMorpheus(src, options) {
    options = options || {};
    const out = [];
    const env = { vars: Object.create(null), funcs: Object.create(null), out, file: options.basePath || '<main>' };
    const loaded = new Set();
    const g = Object.assign(builtins(env), options.builtins || {});

    function evalExpr(node) {
      switch (node.type) {
        case 'Num': case 'Str': case 'Bool': return node.value;
        case 'List': return node.items.map(evalExpr);
        case 'Ident': return lookup(node.name);
        case 'Bin': return applyBin(node.op, evalExpr(node.l), evalExpr(node.r));
        case 'Un': { const v = evalExpr(node.e); return node.op === '-' ? -v : !truthy(v); }
        case 'Call': return callF(node.callee, node.args.map(evalExpr));
        case 'Member': { const o = evalExpr(node.obj); return o[node.name]; }
        case 'Index': { const o = evalExpr(node.obj), i = evalExpr(node.idx); return o[i]; }
        case 'Weave': { const res = []; for (const s of node.body) { const r = execStmt(s); if (r !== undefined) res.push(r); } return res; }
        case 'Prophesy': {
          const vals = [];
          for (let i = 0; i < node.samples; i++) { const r = execBlockValue(node.body); if (typeof r === 'number') vals.push(r); }
          const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
          return round2(mean);
        }
        default: throw new Error('cannot evaluate ' + node.type);
      }
    }
    function applyBin(op, a, b) {
      switch (op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b;
        case '/': if (b === 0) { const e = new Error('/ by zero'); e.name = 'ZeroDivisionError'; throw e; } return a / b;
        case '%': return a % b; case '**': return Math.pow(a, b);
        case '++': return String(a) + String(b);
        case '>': return a > b; case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b;
        case '==': return a === b; case '!=': return a !== b;
        case '&&': case 'and': return truthy(a) ? b : a; case '||': case 'or': return truthy(a) ? a : b;
        default: throw new Error('unknown operator ' + op);
      }
    }
    function truthy(v) { return !!(v && v !== 0); }
    function lookup(name) { if (name in env.vars) return env.vars[name]; throw new Error("undefined variable '" + name + "'"); }
    function callF(callee, args) {
      let name;
      if (callee.type === 'Ident') name = callee.name;
      if (name && g[name]) return g[name](...args);
      if (name && env.funcs[name]) {
        const fn = env.funcs[name];
        const saved = env.vars; env.vars = Object.create(saved);
        fn.params.forEach((p, i) => env.vars[p] = args[i]);
        try { const r = execBlockValue(fn.body); return r; }
        catch (e) { if (e[RET]) return e.value; throw e; }
        finally { env.vars = saved; }
      }
      if (callee.type === 'Member') { const o = evalExpr(callee.obj); const fn = o[callee.name]; return fn.apply(o, args); }
      throw new Error('not a function');
    }
    function execStmt(s) {
      switch (s.type) {
        case 'FuncDecl': env.funcs[s.name] = { params: s.params, body: s.body }; return undefined;
        case 'Extern': return undefined;
        case 'Let': case 'Assign': env.vars[s.name] = evalExpr(s.expr); return undefined;
        case 'ExprStmt': return evalExpr(s.expr);
        case 'If': if (truthy(evalExpr(s.cond))) return execBlockValue(s.body); else if (s.alt) return execBlockValue(s.alt); return undefined;
        case 'While': { let r; let guard = 0; while (truthy(evalExpr(s.cond))) { r = execBlockValue(s.body); if (++guard > 1e7) throw new Error('loop limit exceeded'); } return r; }
        case 'Return': { const e = {}; e[RET] = true; e.value = evalExpr(s.expr); throw e; }
        case 'Heal': { try { return execBlockValue(s.body); } catch (e) { if (e[RET]) throw e; if (s.alt) return execBlockValue(s.alt); throw e; } }
        case 'Block': return execBlockValue(s.body);
        case 'Arena': return execBlockValue(s.body);
        case 'Noop': return undefined;
        case 'Import': {
          const resolve = options.resolve || ((p) => p);
          const full = resolve(s.path, env.file);
          if (!loaded.has(full)) {
            const src2 = (options.modules && (options.modules[full] || options.modules[s.path])) || (options.readFile ? options.readFile(full) : null);
            if (src2 == null) throw new Error('cannot import "' + s.path + '" (no loader in this environment)');
            loaded.add(full);
            const prev = env.file; if (!/^</.test(full)) env.file = full;
            try { for (const st of parse(src2).body) execStmt(st); } finally { env.file = prev; }
          }
          return undefined;
        }
        default: throw new Error('cannot execute ' + s.type);
      }
    }
    function execBlockValue(body) { let r; for (const s of body) r = execStmt(s); return r; }

    // builtins
    function builtins(env) {
      const b = {
        print: (...a) => { out.push(a.map(fmt).join(' ')); return undefined; },
        echo: (...a) => { out.push(a.map(fmt).join(' ')); return undefined; },
        len: (x) => (x && x.length !== undefined) ? x.length : 0,
        abs: Math.abs, pow: Math.pow, sqrt: Math.sqrt, round: (...a) => (a.length > 1 ? Number(a[0].toFixed(a[1])) : Math.round(a[0])),
        sin: Math.sin, cos: Math.cos, exp: Math.exp,
        min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
        random_uniform: (lo, hi) => lo + Math.random() * (hi - lo),
        random_norm: (m, s) => { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
        random_int: (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1)),
        prophesy_ci: (m, s, c) => s * (c || 1.96),
        morph_rewrite: () => undefined, morph_constant: () => undefined,
        read_file: (p) => { if (!options.readFile) throw new Error('read_file: I/O not available in this environment'); return options.readFile(p); },
        write_file: (p, t) => { if (!options.writeFile) throw new Error('write_file: I/O not available in this environment'); options.writeFile(p, String(t)); return undefined; },
        argv: () => (options.argv || []).slice(),
        env: (k) => (options.env ? options.env(k) : undefined),
        clock: () => Date.now() / 1000,
        arena_bytes: () => 0,
        push: (l, v) => { l.push(v); return l; },
        pop: (l) => l.pop(),
        unshift: (l, v) => { l.unshift(v); return l; },
        set: (l, i, v) => { l[i] = v; return l; },
        remove_at: (l, i) => { l.splice(i, 1); return l; },
        rand: (l) => l[Math.floor(Math.random() * l.length)],
        clear: () => { if (options.host && options.host.clear) options.host.clear(); return undefined; },
        sleep: (ms) => { if (options.host && options.host.sleep) options.host.sleep(ms); return undefined; },
        key: () => (options.host && options.host.key ? options.host.key() : ''),
      };
      return b;
    }
    function fmt(v) { if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(round2(v)); return String(v); }
    function round2(x) { return Math.round(x * 1e4) / 1e4; }

    try {
      const ast = parse(src);
      for (const s of ast.body) execStmt(s);

      // Host-driven mode (games / interactive apps): the host owns the loop and
      // input; it calls back into named Morpheus functions. Frames run in the
      // GLOBAL scope, so top-level `let` state persists across frames.
      if (options.deferMain) {
        const call = (name, ...args) => {
          const fn = env.funcs[name];
          if (!fn) throw new Error("no such function: '" + name + "'");
          const saved = {};
          fn.params.forEach((p, i) => { saved[p] = env.vars[p]; env.vars[p] = args[i]; });
          try { return execBlockValue(fn.body); }
          catch (e) { if (e[RET]) return e.value; throw e; }
          finally { fn.params.forEach((p) => { if (saved[p] === undefined) delete env.vars[p]; else env.vars[p] = saved[p]; }); }
        };
        if (typeof options.onReady === 'function') options.onReady({ call, env, out });
        return { output: out.join('\n'), error: null };
      }

      if (env.funcs.main) {
        const fn = env.funcs.main;
        if (fn.params.length) env.vars[fn.params[0]] = (options.argv || []).slice();
        try { execBlockValue(fn.body); } catch (e) { if (e[RET]) {} else throw e; }
      }
      return { output: out.join('\n'), error: null };
    } catch (e) {
      return { output: out.join('\n'), error: e.message || String(e) };
    }
  }

  root.runMorpheus = runMorpheus;
  root.parse = parse;
  root.tokenize = tokenize;
  if (typeof module !== 'undefined' && module.exports) module.exports = { runMorpheus, parse, tokenize };
})(typeof globalThis !== 'undefined' ? globalThis : this);
