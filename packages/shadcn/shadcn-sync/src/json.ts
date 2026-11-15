import { readFileSync } from "node:fs"
import * as z from "zod"

/** Any JSON value, as the registry serves it and as `shadcn-registry.json` stores it. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json }

export const json: z.ZodType<Json> = z.lazy(() =>
  z.union([z.null(), z.boolean(), z.number(), z.string(), z.array(json), z.record(z.string(), json)])
)

export function readJson<Output>(path: string, schema: z.ZodType<Output>): Output {
  return schema.parse(JSON.parse(readFileSync(path, "utf8")))
}

/** JSON with object keys sorted at every level, so equal values always serialize to the same text. */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }

  if (value instanceof Object) {
    const entries = Object.entries(value).toSorted(([a], [b]) => (a < b ? -1 : 1))

    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`
  }

  return JSON.stringify(value)
}
