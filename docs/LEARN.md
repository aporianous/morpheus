# Morphoria — learn to code by playing

**Morphoria**, an Aporia Nous game, teaches the whole language through short,
fun, self-paced units. Earn XP, build combos, climb the ranks,
and finish by **building a real app that is graded by real tests before it runs**.

## Morphoria

Morphoria is a free, self-paced game for learning the Morpheus language. Play at
your own speed — there are no timers and nothing to lose.

**How a chapter works.** Each chapter teaches one small idea. You answer a
question, get friendly feedback right away, then face a quick readiness check. If
a topic still feels shaky, Morphy offers an optional short review of just the
ideas you are least sure about, so you can shore them up before moving on.

**Your progress is saved on your own device**, so you can close the game and pick
up right where you left off.

Questions or help? Reach us any time at support@aporianous.com.

## Play the course

```
node morph.js play learn/morphoria.morph
```

| key | does |
| --- | --- |
| `W` / `S` | move between units |
| `Enter` | select / continue |
| `1` `2` `3` | answer |
| `H` | help |
| `X` | badges |
| `Q` | quit |

Each chapter shows **stars** (up to three) for how well you know its ideas, and you
earn **badges** for milestones — clearing your first chapter, a 5-answer combo, a
three-star chapter, coming back after a shaky chapter, reaching a new rank, and
beating a Boss Review. Progress (XP,
badges, stars, and cleared chapters) is saved to `learn/morphoria_save.txt`
between sessions.

## The units

Each unit teaches **one idea** (a short lesson screen), then quizzes it across
four tiers — **Easy → Medium → Hard → Expert** — so nothing is dumped on you at
once. It is fully **self-paced** (no timers); finish a unit to unlock the next.

1. **Values** — numbers, strings, `type`, precedence (`+` vs `*`, `/`, `%`)
2. **Conditionals** — `when` / `dream` / `dream when`
3. **Loops** — `loop`, `for x in`, `break` / `continue`
4. **Collections** — lists and maps; why map keys must be quoted
5. **Text & Builtins** — `upper`, `split`, `join`, `replace`, `str`, `int`
6. **Functions** — `sovereign`, `signal`, parameters, recursion
7. **Closures** — `fn`, capture-by-value, private mutable state
8. **Structs** — `struct`, fields, nesting, reference semantics
9. **Errors & Modules** — `heal` / `dream`, `import`, safe `get`
10. **Build an App** — the capstone: the course unlocks a build workspace

## The capstone loop (build → check → compile)

Finishing Unit 10 opens a workspace that writes you a starter **`learn/learner.morph`**.
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
