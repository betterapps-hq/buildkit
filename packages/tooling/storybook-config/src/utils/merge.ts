/**
 * Deep-merges configuration objects so consumer config is *combined* with the
 * base rather than replacing it:
 * - Arrays are concatenated (base entries first, then the consumer's).
 * - Plain objects are merged recursively, key by key.
 * - Everything else (strings, numbers, RegExp, functions, ...) is overridden.
 */
function isPlainObject<T>(value: T): value is T & object {
  if (value === null || value === undefined || Array.isArray(value)) {
    return false
  }

  // Primitives have their wrapper's prototype, so only plain objects get this far.
  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

/** The merge has every property of both values, so it is typed as both. */
export function deepMerge<Base, Override>(base: Base, override: Override): Base & Override {
  if (override === undefined) {
    // SAFETY: an undefined override leaves the base as it is.
    return base as Base & Override
  }

  if (Array.isArray(base) && Array.isArray(override)) {
    // SAFETY: the concatenation holds the entries of both arrays.
    return [...base, ...override] as Base & Override
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const merged = new Map(Object.entries(base))

    for (const [key, value] of Object.entries(override)) {
      merged.set(key, merged.has(key) ? deepMerge(merged.get(key), value) : value)
    }

    // SAFETY: the merged object has every key of both objects, each merged the same way.
    return Object.fromEntries(merged) as Base & Override
  }

  // SAFETY: an override that can't be merged replaces the base.
  return override as Base & Override
}
