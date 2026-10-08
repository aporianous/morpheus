# Learn Morpheus — the interactive course

A **Duolingo-style** course that teaches the whole language, written *in Morpheus*.
Earn XP, keep a streak, unlock units, and finish by **building a real app that is
graded by real tests before it compiles**.

## Play the course

```
node morph.js play learn/morpheus_duo.morph
```

| key | does |
| --- | --- |
| `W` / `S` | move between units |
| `Enter` | select / continue |
| `1` `2` `3` | answer |
| `R` | reset progress |
| `Q` | quit |

Progress (XP, streak, cleared units) is saved to `learn/duo_save.txt` between
sessions.

## The units

1. **Values** — numbers, strings, `type`, operator precedence (`+` vs `*`)
2. **Conditionals** — `when` / `dream`, truthiness
3. **Loops** — `loop`, `for x in`, `break` / `continue`
4. **Collections** — lists (`push`, `len`, `sort`) and maps (`keys`, `has`)
5. **Functions** — `sovereign`, `signal`, closures (`fn`) with their own state
6. **Structs** — `struct`, construction, fields, reference semantics
7. **Build an App** — the capstone: the course unlocks a build workspace

## The capstone loop (build → check → compile)

Finishing Unit 7 opens a workspace that writes you a starter **`learn/learner.morph`**.
Then you:

1. **Edit** `learn/learner.morph` — make `to_celsius` actually convert Fahrenheit.
2. **Check** — the course grades your code with real assertions (no fake "well done"):
   ```
   node morph.js run learn/check_capstone.morph
   ```
   It calls *your* function and asserts `to_celsius(32)==0`, `(212)==100`, `(-40)==-40`.
   Only when every assertion passes does it print **PASSED**.
3. **Compile** — turn it into a native app:
   ```
   node morph.js build learn/learner.morph
   ```

That is the whole idea: an interactive course that ends in a **validated build**.

## Starter apps to extend

Each is a real, working app; each has an "EXTEND IT" challenge in its header.

| app | run | teaches | extend it by… |
| --- | --- | --- | --- |
| Calculator | `node morph.js play examples/apps/calculator.morph` | expressions, state, rendering | adding `.` decimals or `%` |
| Quiz | `node morph.js play examples/apps/quiz.morph` | lists of maps, scoring, screens | adding questions to `qs` |
| To-do | `node morph.js run examples/apps/todo.morph list` | file I/O, lists, argv, `struct`-free records | adding a `remove` command |

The to-do app stores data in `todo.txt`, so it persists between runs — a genuine
little database.

## Keep going

- `node morph.js repl` — type Morpheus interactively, state persists across lines.
- `docs/LANGUAGE.md` — the full reference (semantics, EBNF grammar, stdlib).
- `docs/TUTORIAL.md` — a guided tour of the language.
- `examples/` — small focused programs for every feature.
