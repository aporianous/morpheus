# EXTENDING.md — building with Morpheus

Morpheus is open-core: the language, reference interpreter, stdlib and the
extension API are open. You can add vocabulary, features, backends and
packages — without touching the proprietary engine.

## 1. Add a builtin (zero edits)

Pass extra builtins to the interpreter:

```js
const { runMorpheus } = require('./interp.js');

const res = runMorpheus(`
  sovereign main() {
      print(double(21))
      print(shout("morpheus"))
  }
`, {
  builtins: {
    double: (x) => x * 2,
    shout: (s) => String(s).toUpperCase() + "!",
  },
});

console.log(res.output);   // 42 \n MORPHEUS!
```

Names you provide **override** the defaults, so you can also replace `print`
(for example, to route output into your own UI).

## 2. Add a keyword / language feature

The interpreter has three clean stages:

| Stage | Function | Add here |
|---|---|---|
| Lexing | `tokenize(src)` | a new token/keyword |
| Parsing | `parse(src)` → AST | a new statement or expression node |
| Evaluation | `execStmt` / `evalExpr` | what the new node *does* |

Each keyword is one small node type — e.g. `prophesy`, `heal`, `weave` are each
~10 lines. The pattern:

1. add the word to `KW` in the tokenizer;
2. add a `case` in `statement()` or `primary()`;
3. add a `case` in `execStmt()` / `evalExpr()`.

## 3. Backends (polyglot)

The spec allows `from <lang> import <name>` for python / c / cpp / rust / node.
In the browser reference interpreter these are no-ops; a Node embedding can
implement them in the `options.builtins` hook or by extending `fromStmt`.

## 4. Packages & the stdlib

Libraries are just `.morph` files of `sovereign` functions — see `stdlib/`.
To ship one: add a file and document its functions. Users load it with your
host (or copy the functions into their program).

## 5. Design rules (keep it pure)

Morpheus is intentionally small and sovereign. When extending:
- prefer a **new keyword** over overloading an existing one;
- keep values simple (numbers, strings, booleans, lists);
- never require the closed engine for a core language feature;
- document every new builtin in `docs/API_REFERENCE.md`.
