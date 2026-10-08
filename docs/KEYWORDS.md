# KEYWORDS.md — Morpheus Alien Vocabulary

Every keyword in Morpheus comes from the language of dreams, sovereignty,
and transformation. There is no overlap with any existing programming
language.

## Control & Structure

| Keyword | Meaning | Example |
|---|---|---|
| `vision` | Declare a module / package | `vision mypackage` |
| `sovereign` | Declare a function | `sovereign add(a, b) { ... }` |
| `signal` | Return a value from a function / block | `signal 42` |
| `when` | Conditional branch (`if`) | `when x > 0 { ... }` |
| `dream` | Else branch / fallback block | `dream { ... }` |
| `loop` | Repeat-while loop | `loop i < 10 { ... }` |

## Transformation

| Keyword | Meaning | Example |
|---|---|---|
| `morph` | Self-modification block | `morph { ... }` |
| `heal` | Error recovery block | `heal on "ZeroDivisionError" { ... }` |

## Prediction

| Keyword | Meaning | Example |
|---|---|---|
| `prophesy` | Monte Carlo prediction block | `prophesy { expr } with samples: N, confidence: C` |
| `weave` | Parallel execution block | `weave { a() b() }` |

## Interop

| Keyword | Meaning | Example |
|---|---|---|
| `from` | Start a polyglot import | `from python import math` |
| `import` | Import a module | `from c import libc` |

## Lexical

| Token | Meaning |
|---|---|
| `whisper` | Comment (to end of line) |
| `←` | Assignment |
| `≫` | Greater than |
| `≪` | Less than |
| `++` | String concatenation |

## Runtime helper (built-in functions)

Not keywords, but part of the core vocabulary:

| Function | Meaning |
|---|---|
| `morph_rewrite(fn, src)` | Replace a function body at runtime |
| `morph_constant(fn, a, b)` | Swap a constant inside a function |
| `random_uniform(lo, hi)` | Uniform random sample |
| `random_norm(mean, std)` | Gaussian random sample |
| `prophesy_ci(mean, std, conf)` | Confidence-interval helper |
| `heal on "Error"` | Register error recovery |
