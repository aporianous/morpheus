# Contributing to Morpheus

Morpheus is **open core**. Contributions to the open layer are welcome:
the language, the reference interpreter, the standard library, the docs, and
the extension API.

**Not open:** the production runtime. Do not add runtime-internal code here —
that lives in a separate, private component.

## Ways to contribute
- **A builtin or language feature** — see `docs/EXTENDING.md`.
- **A stdlib function** — a `.morph` file in `stdlib/`.
- **A doc fix / a tutorial lesson** — `docs/`, `index.html`.
- **An example** — `examples/`.

## Ground rules
1. Keep the language small and sovereign — prefer a new keyword over overloading.
2. Keep every core language feature runnable on this interpreter alone.
3. Every new builtin gets a line in `docs/API_REFERENCE.md`.
4. Match the existing style: small functions, clear names, no dead code.

## Tests
```
node test.js
```
All examples in `test.js` must pass before a change is merged. Add a case for
anything you add.

## Pull requests
- One change per PR, with a short description of *why*.
- If you add a keyword or builtin, include a `test.js` case and the docs line.
