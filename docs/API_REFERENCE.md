# API_REFERENCE.md — Morpheus Reference

Complete reference for Morpheus keywords, built-in functions, and the
Python API.

---

## Keywords

### `vision name`
Declares the module name. Currently cosmetic.

### `sovereign name(params) { body }`
Declares a function. Re-declaring a name replaces the previous body
(this is how `morph` rewrites functions).

### `signal expr`
Return `expr` (with its confidence) from the enclosing function or block.

### `when cond { body }`
If `cond` evaluates truthy, run `body`.

### `dream { body }`
`else` block. Pairs with `when`. Also used as the recovery block in `heal`.

### `loop cond { body }`
Repeat `body` while `cond` is truthy.

### `morph { body }`
Self-modification block (see `morph_rewrite` / `morph_constant` built-ins).

### `heal on "ErrorType" { body } dream { recovery }`
Try `body`; on the named Python exception, run `recovery` instead.

### `prophesy { expr } with samples: N, confidence: C`
Monte Carlo simulation of `expr`. Defaults: 10,000 samples, 95% confidence.
Returns a `V` whose confidence equals CI coverage.

### `weave { s1 s2 s3 }`
Runs statements concurrently (asyncio). Returns a list of `V` results.

### `from python import math`
Polyglot import. Backends: `python`, `python_file`, `c`, `cpp`, `rust`,
`javascript`/`node`. Imported modules are callable via `module.function(...)`.

### `whisper ...` / `// ...` / `# ...`
Comments.

## Operators

| Operator | Meaning |
|---|---|
| `←` / `=` | assignment |
| `>` / `≫` | greater than |
| `<` / `≪` | less than |
| `>=` `<=` `==` `!=` | comparison |
| `++` | string concat |
| `+ - * / % **` | arithmetic (incl. modulo, power) |
| `&&` `\|\|` `!` | logic (short-circuit) |
| `.` `[]` `()` | attribute, index, call |

## Built-in functions

### Random / prediction
| Function | Signature | Notes |
|---|---|---|
| `random_uniform` | `(lo=0.0, hi=1.0) -> V` | uniform sample, conf 0.5 |
| `random_norm` | `(mean=0.0, std=1.0) -> V` | gaussian sample, conf 0.5 |
| `random_int` | `(lo, hi=100) -> V` | integer sample, conf 0.5 |
| `prophesy_ci` | `(mean, std, conf=0.95) -> V` | value = mean + z*std |

### I/O
| Function | Signature | Notes |
|---|---|---|
| `print` / `echo` | `(*args) -> V(None, 1.0)` | prints space-joined args |

### Collection / math
| Function | Signature | Notes |
|---|---|---|
| `len` | `(x)` | length of list/string |
| `abs` | `(x)` | absolute value |
| `pow` | `(x, y)` | x**y, conf multiplied |
| `sqrt` | `(x)` | square root |
| `round` | `(x, ndigits=0)` | rounding |
| `sin` / `cos` / `exp` | `(x)` | math functions, conf preserved |
| `min` / `max` | `(*args)` | conf = min operand conf |

### Self-modification
| Function | Signature | Notes |
|---|---|---|
| `morph_rewrite` | `(fn_name, source)` | replaces a function body; must be called inside a running function |
| `morph_constant` | `(fn_name, from, to)` | textual constant swap in function body |

---

## Python API

```python
from lang.morpheus_interpreter import MorpheusInterpreter
from lang.morpheus_ast import Lit

interp = MorpheusInterpreter()
interp.run("sovereign f() { signal 5 }")
result = interp.call_function("f")
print(result.value, result.confidence)
```

### `MorpheusInterpreter`
- `run(source)` — parse and execute top-level statements.
- `call_function(name, *args)` — invoke a sovereign function, returns `V`.
- `env` — the `Environment` (variables + functions).
- `fn_stack` — call stack, used by `morph_rewrite`.

### Monte Carlo engine
```python
from lang.morpheus_prophesy import run_monte_carlo
res = run_monte_carlo(interp, expr, samples=10000, confidence=0.95)
# SimulationResult: results, mean, median, std, min, max, ci_low, ci_high
```

### Polyglot
```python
from lang.morpheus_polyglot import import_module
mod = import_module("python", "math")
```

### Encryption
```python
from lang.morpheus_encryption import encrypt_source, decrypt_source
blob = encrypt_source(source, key)
plain = decrypt_source(blob, key)
```

### No-trace execution
```python
from lang.morpheus_no_trace import execute_in_sandbox
```

### Value type `V`
```python
from lang.morpheus_ast import V
v = V(42, 0.9)   # value + confidence
v.value
v.confidence
```
