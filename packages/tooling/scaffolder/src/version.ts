/** The engine's version, recorded in every lock. A test keeps it equal to package.json. */
// SAFETY: widening a string literal to string always holds, and keeps each release's number out of the public type.
export const engineVersion = "0.8.0" as string
