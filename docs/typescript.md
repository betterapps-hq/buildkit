# TypeScript and type helpers

Type conventions for all TypeScript in the monorepo, and a catalog of the type helpers we install, so you don't reinvent
them. Oxlint enforces many of these rules (see
[`packages/tooling/oxlint-config/src/base.ts`](../packages/tooling/oxlint-config/src/base.ts)).

Import the helpers from [`@buildkitgg/typescript-utils`](../packages/core/typescript-utils/README.md), which re-exports
ts-extras, ts-pattern, tiny-invariant, es-toolkit, and type-fest from one root import. Don't install or import those
packages directly.

```ts
import { invariant, isPresent, match, objectKeys, P } from "@buildkitgg/typescript-utils"
```

## Conventions

- Don't use `any`. Type a genuinely unknown value as `unknown` and narrow it.
- Avoid `as` type assertions, which silence the compiler. `as const` is fine; the rule is about type assertions. To
  narrow, see the order of preference below.
- Prefer `type` over `interface`. Reach for `interface` when you need a feature unique to it, such as declaration
  merging.
- Let return types infer. Add an explicit return type only to lock a public or shared API contract.
- Prefer string-literal unions over `enum`s, and pair them with exhaustive handling.
- Prefix boolean variables with `is` or `has` (`isLoading`, `hasError`).
- Validate external data with `zod` at the boundary. Never trust network or environment input.

## Type narrowing

Narrow types in this order of preference, and don't reach for `as`:

1. A type guard: a `function isThing(x: unknown): x is Thing` predicate.
2. `invariant(cond, msg)`, which asserts a runtime assumption and narrows afterward.
3. `assertNever(x)` or `match(x).exhaustive()` for exhaustive unions.

## ts-extras: type-safe built-in helpers

Typed replacements for unsafe built-ins. Use these instead of casting.

### Objects

- `objectKeys(obj)` — like `Object.keys`, but typed `(keyof obj)[]` instead of `string[]`.
- `objectEntries(obj)` — typed `[key, value]` tuples.
- `objectValues(obj)` — typed values.
- `objectFromEntries(entries)` — typed inverse of `objectEntries`.
- `objectHasOwn(obj, key)` — typed `Object.hasOwn` that narrows the object to include the key.
- `objectHasIn(obj, key)` — the same check including inherited properties, like `key in obj`.
- `objectAssign(target, ...sources)` — typed `Object.assign`.
- `objectMapValues(obj, fn)` — map an object's values, preserving keys.
- `objectUpdate(target, source)` — apply a type-checked partial update to an object in place.

### Arrays

- `arrayIncludes(array, item)` — like `Array#includes`, but narrows `item` (works with `readonly` literal tuples).
- `arrayAt(array, index)`, `arrayFirst(array)`, `arrayLast(array)` — element access typed `T | undefined` for arrays and
  exactly for tuples.
- `arrayConcat`, `arrayJoin` — typed `concat` and `join`; `arrayJoin` keeps literal string types.

### Guards and assertions

- `isDefined(x)` / `isPresent(x)` — narrow out `undefined`, or both `null` and `undefined`. Useful in `.filter()`.
- `isPropertyDefined(key)` / `isPropertyPresent(key)` — build a predicate that narrows one property, for `.filter()`.
- `isEmpty(array)` — check whether an array is empty.
- `keyIn(obj, key)` — check that a key exists in an object and narrow the key.
- `assertDefined(x)`, `assertPresent(x)`, `assertError(x)`, `assertNever(x)` — throw and narrow.
- `not(predicate)` — invert a type-guard predicate while keeping narrowing.

### Numbers

- `isFinite`, `isInfinite`, `isInteger`, `isSafeInteger` — typed numeric checks.

### Miscellaneous

- `safeCastTo<T>(value)` — constrain a value to a type it already satisfies, without an unsafe assertion.
- `asWritable(x)` — remove `readonly` from a value's type.
- `isEqualType`, `stringSplit`, `setHas` — type-level equality, typed `split`, and typed `Set#has`.

## ts-pattern: pattern matching

Branch on unions and shapes with `match` instead of `switch` or nested conditionals.

```ts
import { match, P } from "@buildkitgg/typescript-utils"

const label = match(result)
  .with({ status: "ok", data: P.select() }, (data) => `ok: ${data}`)
  .with({ status: "error", error: P.instanceOf(Error) }, ({ error }) => error.message)
  .with({ status: "loading" }, () => "loading…")
  .exhaustive() // compile error if a case is missing
```

Key API:

- `match(value)`, then `.with(pattern, handler)`, ending with `.exhaustive()` (enforces every case) or `.otherwise(fn)`
  (a default). Use `.returnType<T>()` to pin the return type.
- Patterns from `P`: `P._` / `P.any`, `P.string`, `P.number`, `P.boolean`, `P.bigint`, `P.nullish`, `P.array(pattern)`,
  `P.set`, `P.map`, `P.union(...)`, `P.intersection(...)`, `P.not(pattern)`, `P.optional(pattern)`,
  `P.instanceOf(Class)`, `P.when(predicate)`, `P.select()` (extracts a value), and string and number refinements such as
  `P.string.startsWith(...)` and `P.number.gte(...)`.
- `isMatching(pattern)` — a standalone type guard built from a pattern.

## tiny-invariant: runtime assertions

`@buildkitgg/typescript-utils` exports tiny-invariant's default export as `invariant`.

```ts
import { invariant } from "@buildkitgg/typescript-utils"

invariant(user, "user must be loaded before render") // throws if falsy
user.name // narrowed to non-null here
```

Production builds strip the message. Use an invariant for assumptions that should always hold, such as loaded data or a
found DOM node, not for expected or validation errors.

## zod: schema validation

Validate and parse untrusted input, and infer static types from the schemas.

```ts
import { z } from "zod"

const User = z.object({ id: z.string(), email: z.email() })
type User = z.infer<typeof User>

const user = User.parse(await res.json()) // throws on mismatch
const result = User.safeParse(input) // { success, data | error }
```

Pass a Zod schema directly to TanStack Form, for example `validators: { onSubmit: User }`. Reuse the schema at the API
boundary when both inputs have the same contract.
