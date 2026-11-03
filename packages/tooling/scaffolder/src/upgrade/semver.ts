import semver from "semver"

function requireVersion(version: string): string {
  const valid = semver.valid(version)

  if (valid === null) {
    throw new Error(`"${version}" isn't a semantic version.`)
  }

  return valid
}

/** Compares two semantic versions: negative when `left` is lower, zero when equal, positive when higher. */
export function compareVersions(left: string, right: string): number {
  return semver.compare(requireVersion(left), requireVersion(right))
}

export function isValidVersion(version: string): boolean {
  return semver.valid(version) !== null
}

/**
 * Whether a string is an npm range, such as `^1.2.0`, `~1.2` or `>=1 <3`. Dist-tags such as `latest` aren't, and
 * neither is an empty range or `||` set, which npm would read as `*`.
 */
export function isValidRange(range: string): boolean {
  return !range.split("||").some((set) => set.trim() === "") && semver.validRange(range) !== null
}

/**
 * The lowest version a range allows: `^1.2.0` gives 1.2.0, `~0.45 || ^1` gives 0.45.0, and `<2` gives 0.0.0. A range
 * that allows nothing, such as `>=2 <1`, gives `undefined`.
 */
export function lowestVersion(range: string): string | undefined {
  return semver.minVersion(range)?.version
}

/**
 * Whether a version is in an npm range, such as `^1.2.0`, `>=1.0.0 <3.0.0` or `^1 || ^3`. A prerelease is in a range
 * only when the range names a prerelease of the same version.
 */
export function satisfiesRange(version: string, range: string): boolean {
  if (semver.validRange(range) === null) {
    throw new Error(`"${range}" isn't a version range.`)
  }

  return semver.satisfies(requireVersion(version), range)
}
