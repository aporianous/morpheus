# TUTORIAL.md — Morpheus by Example

A step-by-step introduction to the Morpheus language.
Run any example with:

```
python -m morpheus.lang.morpheus run tutorial.morph
```

---

## 1. Hello, Dreamer

```morph
sovereign main() {
    print("Hello, Perseus!")
}
```

Every program is a collection of `sovereign` functions. The `main` function is
the entry point.

## 2. Variables

```morph
sovereign main() {
    let greeting ← "Hello"
    let target ← "Morpheus"
    print(greeting ++ " " ++ target)
}
```

- `let name ← value` declares a variable.
- `++` concatenates strings.

## 3. Functions and return values

```morph
sovereign add(a, b) {
    signal a + b
}

sovereign main() {
    let result ← add(2, 3)
    print(result)
}
```

`signal` returns a value, exactly like `return`.

## 4. Conditionals

```morph
sovereign classify(x) {
    when x > 10 {
        signal "big"
    }
    dream {
        signal "small"
    }
}

sovereign main() {
    print(classify(100))
    print(classify(5))
}
```

`when` / `dream` is Morpheus's `if` / `else`. Both `>` and the alien `≫` work.

## 5. Loops

```morph
sovereign count_down(n) {
    let i ← n
    loop i > 0 {
        print(i)
        let i ← i - 1
    }
}
```

## 6. Predicting the future — `prophesy`

Morpheus is *inherently predictive*. Wrap any expression in `prophesy` to get
a Monte Carlo simulation:

```morph
sovereign revenue_forecast() {
    signal prophesy {
        random_norm(100000, 20000)
    } with samples: 5000, confidence: 0.95
}

sovereign main() {
    let forecast ← revenue_forecast()
    print(forecast)
}
```

The result is a value with a confidence interval; the confidence reflects what
fraction of the 5,000 simulations landed inside the interval.

## 7. Self-modification — `morph`

Functions can rewrite themselves at runtime:

```morph
sovereign counter() {
    signal 1
}

sovereign main() {
    print(counter())                       // 1
    morph_rewrite("counter", "sovereign counter() { signal 42 }")
    print(counter())                       // 42
    morph_constant("counter", "42", "99")
    print(counter())                       // 99
}
```

- `morph_rewrite(fn, source)` replaces the function body.
- `morph_constant(fn, from, to)` swaps a literal inside the body.

## 8. Self-healing — `heal`

Errors can be caught and recovered natively:

```morph
sovereign safe_divide(a, b) {
    heal on "ZeroDivisionError" {
        signal a / b
    }
    dream {
        signal 0
    }
}

sovereign main() {
    print(safe_divide(10, 2))   // 5.0
    print(safe_divide(10, 0))   // 0 (healed)
}
```

When the guarded block raises `ZeroDivisionError`, the `dream` recovery block
runs instead of crashing.

## 9. Polyglot — talk to other languages

```morph
sovereign floor_test() {
    from python import math
    signal math.floor(2.9)
}

sovereign main() {
    print(floor_test())   // 2
}
```

Morpheus can import Python modules directly. Other backends (`c`, `cpp`,
`rust`, `javascript`, `python_file`) are supported through the same `from ... import` syntax.

## 10. Parallelism — `weave`

Run independent work concurrently:

```morph
sovereign heavy(n) {
    let acc ← 0
    let i ← 0
    loop i < n {
        let acc ← acc + i
        let i ← i + 1
    }
    signal acc
}

sovereign main() {
    let results ← weave {
        heavy(100000)
        heavy(100000)
    }
    print(len(results))
}
```

`weave` runs its branches with Python asyncio and returns a list of results.

---

## What's next

Read `API_REFERENCE.md` for the complete keyword and built-in reference,
`LANGUAGE_SPEC.md` for the formal grammar, and `MONTE_CARLO.md` for the
prediction engine internals.
