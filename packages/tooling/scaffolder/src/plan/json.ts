/** JSON helpers shared by the planner, the merges and the lock: canonical form, equality and JSON pointers. */
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns -- these helpers take documents parsed from JSON and YAML, before anything knows their structure */

const unsafeKeys = new Set(["__proto__", "constructor", "prototype"])

/** Keys that would reach an object's prototype when assigned. Merges refuse them anywhere in a document. */
export function isUnsafeKey(key: string): boolean {
  return unsafeKeys.has(key)
}

// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- an object in a parsed document holds anything, and each caller decodes the values it reads
export function isRecord(value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- this guard is how the core decodes objects in values it hasn't parsed yet
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** True for a string, in a value the core is decoding, such as a catalog entry that's an id or an object. */
export function isString(value: unknown): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- this guard is how the core decodes strings in values it hasn't parsed yet
  return typeof value === "string"
}

/** Serializes with object keys sorted by code unit, so equal values always produce the same string. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    return "null"
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`
  }

  if (isRecord(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()

    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  }

  return JSON.stringify(value)
}

/** Pretty JSON with object keys sorted by code unit and a final newline, for derived files such as the lock. */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .flatMap((key) => (value[key] === undefined ? [] : [[key, sortKeys(value[key])] as const]))
    )
  }

  return value
}

/** Orders strings by code unit, never by locale, so output is the same on every machine. */
export function compareText(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

/** True when the value survives a JSON round trip unchanged: plain objects, arrays, strings, finite numbers, booleans and null. */
export function isJsonValue(value: unknown): boolean {
  if (value === null || value === true || value === false || isString(value) || Number.isFinite(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item))
  }

  if (isRecord(value)) {
    const prototype: unknown = Object.getPrototypeOf(value)

    return (
      (prototype === Object.prototype || prototype === null) &&
      Object.entries(value).every(([key, item]) => !isUnsafeKey(key) && isJsonValue(item))
    )
  }

  return false
}

/** Parses an RFC 6901 pointer such as `/dependencies/@lingui~1core` into object keys. */
export function parsePointer(pointer: string): string[] {
  if (pointer === "") {
    return []
  }

  if (!pointer.startsWith("/")) {
    throw new Error(`JSON pointer "${pointer}" must start with "/".`)
  }

  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
}

export function formatPointer(segments: readonly string[]): string {
  return segments.map((segment) => `/${segment.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("")
}

/** What a JSON pointer finds in a document: whether the value is there, and the value. */
export interface PointerRead {
  found: boolean
  value: unknown
}

export function readPointer(document: unknown, segments: readonly string[]): PointerRead {
  let current: unknown = document

  for (const segment of segments) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) {
      return { found: false, value: undefined }
    }

    current = current[segment]
  }

  return { found: true, value: current }
}
