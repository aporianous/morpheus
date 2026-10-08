# The Morpheus Language

Morpheus has two ways to write the same programs:

- **dynamic** (the default) — values are tagged; the reference interpreter runs
  it directly, and the native backend compiles it with boxed `Value`s.
- **typed** — annotate a function (`sovereign f(n: int) -> int`) and the native
  backend emits real C++ scalar types (`long long`, `double`, `std::string`,
  `bool`) with no boxing, no heap and no GC.

Both backends are held to the same behavior by `conformance.js`.

## Comments
```
whisper free text to end of line
```

## Values
`number`, `string`, `boolean`, `list`, `map`. A value may also carry a
confidence (see **prophesy**).

## Variables
```
let x = 3
let name = "Ada"
let xs = [1, 2, 3]
let m  = { "a": 1, "b": 2 }
```

## Control flow
```
when x < 0 { print("neg") }
dream when x == 0 { print("zero") }      # else-if
dream { print("pos") }                   # else

loop x < 10 { x = x + 1 }                # while
for v in [1, 2, 3] { print(v) }          # for-in over list, string, or range
for c in "abc" { print(c) }

for v in 0..5 {                          # range: 0,1,2,3,4
    when v == 2 { continue }
    when v == 4 { break }
    print(v)
}

let label = x > 0 ? "yes" : "no"         # ternary
```

## Functions
```
sovereign add(a, b) { signal a + b }     # signal returns a value
sovereign fib(n: int) -> int {           # typed → long long fib(long long)
    when n < 2 { signal n }
    signal fib(n - 1) + fib(n - 2)
}
```

`main(args)` receives the command-line arguments as a list of strings.

## Functions as values (lambdas)
```
let dbl = fn(x) { signal x * 2 }
print(dbl(21))                       # 42

sovereign apply(f, x) { signal f(x) }   # take a function as an argument
print(apply(dbl, 5))                 # 10

sovereign make_adder(n) { signal fn(x) { signal x + n } }   # return one
let add10 = make_adder(10)
print(add10(5))                      # 15

let fs = [fn(x){ signal x + 1 }, fn(x){ signal x * 10 }]
```
**Closures.** A lambda captures the variables it uses by **value** (a snapshot
taken when the lambda is created), so later changes to those outer variables are
not seen. A lambda keeps its **own** mutable copies across calls: a counter
lambda that reassigns a captured variable keeps counting, while the outer
variable is unchanged. A value that is a function has `type(f) == "function"`
and prints as `<fn>`. Calling a non-function is a runtime error.

## Collections
```
let xs = [5, 3, 9]
print(xs[0])            # 5
print(xs[1:3])          # [3, 9]     (slice)
xs.push(1)              # in place

let m = { "a": 1 }
print(m["a"])           # 1
print(m.keys())         # ["a"]
m.put("b", 2)           # or: put(m, "b", 2)
print(m.has("b"))       # true

for k in m.keys() { print(k) }
```

## Structs (user-defined types)
```
struct Point { x, y }

let p = Point(3, 4)     # construct: fields in declaration order
print(p.x)              # field access
p.x = 10                # field assignment

struct Line { a, b }
let l = Line(Point(1, 2), Point(3, 4))
print(l.b.y)            # 4 — structs nest
```
A struct value is a map with those keys, so `keys(p)`, `p.has("x")`,
`for k in p.keys()` work exactly as for a map. Structs are **reference-like**:
`let q = p` shares the same instance, so mutating `q.x` changes `p.x`.
Reading a field that does not exist is a `KeyError`.

## Member sugar
A method call on a value is sugar for a call with that value first:
```
s.upper()        ==  upper(s)
s.split(" ")     ==  split(s, " ")
xs.contains(3)   ==  contains(xs, 3)
m.keys()         ==  keys(m)
```

## Prophesy (confidence)
`prophesy expr` returns a distribution — a mean plus a confidence — by sampling
the expression's random inputs (Monte-Carlo). See `examples/forecast.morph`:
```
let revenue = prophesy price * units
print(revenue)          # a conservative / typical estimate
```

## Standard library
Conversions: `type int float str`
Math: `abs sqrt pow sin cos exp tan log floor ceil round min max random_int random_uniform random_norm`
Sequences: `len range sum min_of max_of sort reverse contains index_of`
Strings: `upper lower trim split join substr replace starts_with ends_with repeat`
Lists: `push pop shift unshift insert remove set reverse`
Maps: `keys values has get put del contains`
I/O & host: `read_file write_file argv env clock clear sleep key print echo`

## Memory
```
arena {
    ...                 # everything allocated here is freed when the block exits
    print(arena_bytes())    # live bytes (native)
}
```
Deterministic scoped reclamation — no garbage collector. `arena_bytes()` reports
live bytes; the reference interpreter does not track them.

## Modules & FFI
```
import "text.morph"                       # load a module
extern sqrt(x: float) -> float            # bind a C function (link with -l m)
```

## Semantics (normative)

These rules are guaranteed identical on the reference interpreter and the
native backend, and are enforced by `divergence.js`.

**Numbers.** One numeric type (IEEE-754 double). `/` always yields a real
(`7/2 == 3.5`). Integers print with no decimal point; non-integers print with at
most 6 fractional digits and trailing zeros trimmed (`0.5`, `1.25`, `0.333333`).

**Truthiness.** `false`, `0`, `""`, `[]`, `{}` are false; everything else true.

**Equality.** `==` / `!=` compare by value for numbers, strings and booleans;
lists and maps compare by identity (a collection equals itself). Ordering
`< > <= >=` is defined for numbers.

**Map order.** A map's `keys`, `values`, `print` and `for … in m.keys()` iterate
in **ascending key order** (lexicographic). Both backends guarantee this.

**Indexing.** `a[i]` requires an integer `i` in `[0, length)`. Out of range is a
runtime **IndexError**; negative indices are errors (no wrap). `str[i]` yields a
1-character string. `m[k]` requires the key to exist (else **KeyError**) — use
`m.get(k, default)` to supply a fallback.

**Slicing.** `a[i:j]` clamps (`i<0→0`, `j>len→len`, `j<i`→empty) and never errors.
Omitted bounds default to `0` / `length`.

**Mutation.** `put` / `del` / `push` / `insert` / `remove` / `set` mutate the
collection in place and return it. Numbers and strings are value-like.

**Errors.** A runtime error prints `Error: <message>` and exits non-zero. The two
backends agree on *whether* an operation errors; the message text is
implementation-defined. Free (undeclared) names are a runtime error in the
interpreter and a compile-time error in the native backend.

## Grammar (informal)
```
program   := (import | extern | funct | stmt)*
funct     := "sovereign" NAME "(" params ")" ("->" type)? block
stmt      := "let" NAME "=" expr | "when" expr block ("dream" ...)?
           | "loop" expr block | "for" NAME "in" expr block
           | "break" | "continue" | "signal" expr | "return" expr
           | "arena" block | "prophesy" expr | assign | expr
expr      := term (("+"|"-"|"++") term)*
term      := factor (("*"|"/"|"%") factor)*
unary     := ("-"|"!") unary | postfix
postfix   := primary (call | index | slice | "." NAME)*
primary   := NUMBER | STRING | "true" | "false" | NAME | list | map | "(" expr ")"
           | range | ternary
```
