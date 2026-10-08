# Morpheus

**A small, sovereign programming language — open core.**

Morpheus is a language for code that *morphs*: functions that rewrite
themselves at runtime, values that carry a **confidence**, and a predictive
`prophesy` primitive. It is **open-core** — the language and its tooling are
open; the runtime engine and substrate are proprietary.

## Open (this repo)
- The language: syntax, keywords, the spec.
- A **reference interpreter** (`interp.js`) — runs in the browser and in Node.
- The standard library (`stdlib/`).
- An **extension API** — register builtins, add language features, ship packages.
- Docs and an interactive tutorial.

## Closed
- The runtime **engine** and the **wave / substrate core**. Programs here run on
  the open reference interpreter; the production engine is a separate, private
  component.

## Try it
- **Interactive:** open `index.html` (or the GitHub Pages site).
- **Node:**
  ```
  node -e "console.log(require('./interp.js').runMorpheus('sovereign main(){ print(1 + 2) }').output)"
  ```

## Extend it
See [`docs/EXTENDING.md`](docs/EXTENDING.md). The base hook:
```js
const { runMorpheus } = require('./interp.js');
runMorpheus(src, { builtins: { double: (x) => x * 2 } });
```

## Layout
| Path | What |
|---|---|
| `interp.js` | reference interpreter (lexer → parser → evaluator) + extension hook |
| `index.html` | interactive tutorial + live playground |
| `stdlib/` | `.morph` standard library |
| `docs/` | spec, keywords, tutorial, API reference, extending |
| `examples/` | sample programs |

## Status
The language and reference interpreter are real and tested. The engine that
gives the language its predictive/wave behaviour is closed and not included.

## License
The language, interpreter, docs and stdlib in this repo are **MIT** (see
`LICENSE`). The name *Morpheus*, the runtime engine, and the substrate remain
proprietary to Aporia Nous.
