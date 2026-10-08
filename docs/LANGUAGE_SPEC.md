# LANGUAGE_SPEC.md — Morpheus Language Specification

Morpheus is a sovereign, self-evolving, predictive, polyglot programming language.
It is named after the Greek god of dreams and shapeshifting.

## Philosophy
- Code that **morphs** — self-modification at runtime.
- Every value carries an implicit **confidence** (0..1).
- **Predictive by nature** — `prophesy` returns Monte Carlo statistics (mean + confidence).
- **Polyglot by nature** — calls Python, C, C++, Rust, and Node.
- **Heals itself** — native error recovery.
- **Local-first, sovereign** — no cloud, no vendor lock-in.

## File extensions
| Extension | Meaning |
|---|---|
| `.morph` | Plain Morpheus source |
| `.morphx` | Encrypted Morpheus blob (ChaCha20-Poly1305, scrypt KDF) |

## Lexical structure
- Comments: `whisper ...` to end of line, `// ...`, or `# ...`.
- Strings: `"double"` or `'single'`, with `\n \t \r \\ \" \'` escapes.
- Numbers: integers and floats (`42`, `3.14`).
- Identifiers: letters, digits, `_`, `$` (cannot start with a digit).
- Boolean literals: `true`, `false`.

## Keywords (the "alien" vocabulary)
| Keyword | Meaning |
|---|---|
| `vision` | module / package declaration |
| `sovereign` | function declaration |
| `when` | conditional (`if`) |
| `dream` | else block |
| `signal` | return value |
| `morph` | self-modification block |
| `heal` | error recovery block |
| `prophesy` | Monte Carlo prediction block |
| `weave` | parallel execution block |
| `whisper` | comment |
| `loop` | repeat-while loop |
| `from … import …` | polyglot import |

## Operators
| Operator | Meaning |
|---|---|
| `←` or `=` | assignment |
| `≫` or `>` | greater than |
| `≪` or `<` | less than |
| `>=` `<=` `==` `!=` | comparison |
| `++` | string concatenation |
| `+ - * / % **` | arithmetic |
| `&&` `\|\|` `!` | logic (short-circuit) |
| `.` `[]` `()` | attribute, index, call |

## Variables
```
let name ← value
```
Assignment without `let` updates an existing binding (or creates one).

## Functions
```
sovereign add(a, b) {
    signal a + b
}
```
Functions are declared once; later `sovereign` statements with the same name
replace the body (this is what `morph` uses internally).

## Conditionals
```
when condition {
    ...
}
dream {
    ...
}
```

## Loops
```
loop i ≪ n {
    let i ← i + 1
}
```

## Confidence propagation
Every runtime value is a tuple `(value, confidence)`. Binary operations multiply
the confidences of their operands (`conf_result = conf_a * conf_b`). Random
sampling functions return `0.5` confidence.

## Self-modification (morph)
```
sovereign counter() { signal 1 }

sovereign main() {
    morph_rewrite("counter", "sovereign counter() { signal 42 }")
    print(counter())   // 42
    morph_constant("counter", "42", "99")
    print(counter())   // 99
}
```
- `morph_rewrite(functionName, newSource)` re-parses and installs a new body.
- `morph_constant(functionName, from, to)` swaps constants via AST serialization.

## Self-healing (heal)
```
sovereign safe_divide(a, b) {
    heal on "ZeroDivisionError" {
        signal a / b
    }
    dream {
        signal 0
    }
}
```
When the guarded block raises a matching exception, the `dream` recovery block
runs; its `signal` becomes the function result.

## Monte Carlo (prophesy)
```
sovereign estimate() {
    signal prophesy { random_norm(5, 1) } with samples: 10000, confidence: 0.95
}
```
Runs N simulations of the expression, returns a value with its confidence
bounded by the CI coverage. Defaults: 10,000 samples, 95% confidence.

## Parallelism (weave)
```
let results ← weave {
    heavy_work(100000)
    heavy_work(100000)
}
```
Branches execute concurrently via Python asyncio.

## Polyglot bridge
```
sovereign floor_test() {
    from python import math
    signal math.floor(2.9)     // 2
}
```
Supported languages: `python` (importlib), `python_file` (load a .py by path),
`c`/`cpp`/`rust` (ctypes for shared libraries), `javascript`/`node` (subprocess).

## Encryption & no-trace
- `morpheus_encryption.py`: ChaCha20-Poly1305 authenticated encrypted source
  blobs, key derived via scrypt from a session secret and never persisted.
- `morpheus_no_trace.py`: executes in a temp work dir and wipes it on exit;
  buffer zeroing is best-effort (Python strings are immutable).

## Built-in functions
`random_uniform(lo, hi)`, `random_norm(mean, std)`, `random_int(lo, hi)`,
`print(...)`, `echo(...)`, `len(x)`, `abs(x)`, `pow(x, y)`, `sqrt(x)`,
`round(x, n)`, `sin(x)`, `cos(x)`, `exp(x)`, `min(...)`, `max(...)`,
`prophesy_ci(mean, std, conf)`, `morph_rewrite(fn, src)`, `morph_constant(fn, a, b)`.

## Standard library (stdlib.morph)
`clamp(x, lo, hi)`, `sum(items)`, `average(items)`, `normalize(value, min, max)`.

## Run it
```
python -m morpheus.lang.morpheus run program.morph
```
