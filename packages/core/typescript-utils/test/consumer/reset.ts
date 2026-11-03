// ts-reset applies to the whole program once any file imports the package, including files that do not import it.
const parsed = JSON.parse("{}")

// @ts-expect-error ts-reset types JSON.parse as unknown
export const count: number = parsed

export const present: number[] = [1, undefined].filter(Boolean)
