# Morpheus

**A small, sovereign programming language — open core.**

Morpheus is a language for code that *morphs*: functions that rewrite
themselves at runtime, values that carry a **confidence**, and a predictive
`prophesy` primitive. It is **open-core** — the language and its tooling are
open; a separate production runtime is private.

## Open (this repo)
- The language: syntax, keywords, the spec.
- A **reference interpreter** (`interp.js`) — runs in the browser and in Node.
- The standard library (`stdlib/`).
- An **extension API** — register builtins, add language features, ship packages.
- Docs and an interactive tutorial.

## Private
- The production **runtime** — a separate, private component used for deployment.
  Everything in this repo runs on the open reference interpreter above.

## Try it
- **Interactive:** open `index.html` (or the GitHub Pages site).
- **Node:**
  ```
  node -e "console.log(require('./interp.js').runMorpheus('sovereign main(){ print(1 + 2) }').output)"
  ```
- **CLI** — run programs and games:
  ```
  node morph.js run  examples/notes.morph examples/sample.txt   # a batch app
  node morph.js play examples/snake.morph                       # a real-time game
  ```

## Build apps
Morpheus is enough to write real programs: `import` modules, file I/O
(`read_file` / `write_file`), `argv`, and — for games — a host-driven frame
loop (`clear` / `key` / `sleep`, with `deferMain` + `onReady`) where the host
owns the keyboard and the clock and Morpheus owns the logic. See `examples/`:
`notes.morph` (a file summariser) and **`snake.morph`** (a full Snake game —
10 levels, wandering enemies, god mode).

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
| `morph.js` | CLI — `run` a program, `play` a game |
| `index.html` | interactive tutorial + live playground |
| `stdlib/` | `.morph` standard library |
| `docs/` | spec, keywords, tutorial, API reference, extending |
| `examples/` | sample apps, incl. a full `snake.morph` game |

## Status
The language and reference interpreter are real and tested. A separate
production runtime is used for deployment; it is not included here.

## License
The language, interpreter, docs and stdlib in this repo are **MIT** (see
`LICENSE`). The name *Morpheus* and the production runtime remain
proprietary to Aporia Nous.
