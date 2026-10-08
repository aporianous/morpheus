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
