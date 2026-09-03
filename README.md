# agent-verification-framework

A dependency-light TypeScript framework for **verifying AI agents** — property-based testing, runtime rule validation, and deterministic, reproducible checks. It gives you a single, honest verdict on whether an agent's output is trustworthy before you let it act.

Built by [Retsumdk](https://github.com/Retsumdk).

## Problem

Autonomous agents produce outputs that are hard to trust. A single bad response can trigger a cascade of failures, yet most agent code is only "tested" by a happy-path unit test. There is no lightweight, language-native way to say: *this agent's output is correct across many inputs, and every field it returned satisfies the contract I expect.*

## Solution

This framework provides two complementary verification layers:

1. **Property-based testing** — define a *generator* (how to produce inputs) and an *invariant* (what must always be true). The runner samples many inputs and reports the first counterexample. This catches edge cases a hand-written test never thinks of.
2. **Runtime rule validation** — validate an agent's actual output against a declarative contract of rules (`type`, `min`, `max`, `enum`, `matches`) at dotted paths. This is the gate you run before an agent's output is allowed to take effect.

Everything is deterministic and reproducible — you control the sample count, and generators are seeded.

## How it works

```
┌──────────────┐   verify()   ┌──────────────────────────┐
│  Properties  │ ───────────▶ │  VerificationReport       │
│  + Rules     │              │  properties[]  (pass/fail)│
│  + Output    │              │  ruleResults[] (pass/fail)│
└──────────────┘              │  ok / summary             │
                              └──────────────────────────┘
```

- **`Property<T>`** — `{ name, generate(), check() }`. The runner calls `generate()` N times and asserts `check(value)` each time.
- **`Rule`** — a declarative contract: `{ kind, path, ... }` where `kind` is `type` | `min` | `max` | `enum` | `matches`.
- **`verify()`** — runs all properties and applies all rules to an output object, returning a `VerificationReport`.
- **`readPath()`** — resolves a dotted path (`"agent.result.score"`) inside a nested object.

## Getting started

Requires [Bun](https://bun.sh) (v1.0+).

```bash
git clone https://github.com/Retsumdk/agent-verification-framework.git
cd agent-verification-framework
bun install
bun run build
bun test
```

## Usage

### As a library

```ts
import { verify, intBetween, mulberry32 } from "./src/verifier";
import type { Property, Rule } from "./src/types";

const properties: Property<number>[] = [
  {
    name: "score is within 0..100",
    generate: () => intBetween(mulberry32(7), 0, 100),
    check: (v) => v >= 0 && v <= 100,
  },
];

const rules: Rule[] = [
  { kind: "type", path: "status", type: "string" },
  { kind: "enum", path: "status", values: ["success", "failure"] },
  { kind: "min", path: "score", min: 0 },
  { kind: "max", path: "score", max: 100 },
];

const report = verify(properties, rules, { status: "success", score: 88 });
console.log(report.summary); // "PASS"
```

### As a CLI

```bash
# Run the built-in property checks (100 samples each)
bun run src/index.ts run -n 100
# → ✓ random string is 10 chars (100 runs, 0 failures)
# → PASS

# Validate an agent output file against a rules file
bun run src/index.ts validate -o output.json -r rules.json
# → ✓ type@status
# → ✗ max@score — value 150 > max 100
# → FAIL (exit code 1)
```

`rules.json` is a flat map of dotted path → rule:

```json
{
  "status": { "type": "string", "enum": ["success", "failure"] },
  "score":  { "type": "number", "min": 0, "max": 100 },
  "tags":   { "type": "array" }
}
```

## API

| Symbol | Description |
|--------|-------------|
| `Property<T>` | `{ name, generate(), check() }` — a property to verify |
| `Rule` | Declarative contract: `type` / `min` / `max` / `enum` / `matches` at a path |
| `verify()` | Runs properties + applies rules, returns a `VerificationReport` |
| `runProperty()` | Runs a single property and returns its result |
| `applyRule()` | Applies a single rule to an output value |
| `readPath()` | Resolves a dotted path in a nested object |
| `intBetween()` / `randomString()` | Seeded generators for property testing |
| `mulberry32()` | Deterministic PRNG for reproducible runs |

## Tests

```bash
bun test
```

Nine tests cover property pass/fail with counterexamples, every rule kind, path resolution, and end-to-end report aggregation.

## License

MIT — see [LICENSE](LICENSE).
