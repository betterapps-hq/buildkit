// Type-checked by `pnpm check:types` against the built package, the way an app consumes it.
import { chunk, invariant, isPresent, match, P, type SetRequired } from "@buildkitgg/typescript-utils"

type Shape = { kind: "circle"; radius: number } | { kind: "square"; size: number }
type Config = SetRequired<{ name?: string }, "name">

export function area(shape: Shape) {
  return match(shape)
    .with({ kind: "circle" }, ({ radius }) => Math.PI * radius ** 2)
    .with({ kind: "square", size: P.number }, ({ size }) => size ** 2)
    .exhaustive()
}

export function rows(values: (number | undefined)[], config: Config) {
  invariant(config.name, "config needs a name")
  return chunk(values.filter(isPresent), 2)
}
