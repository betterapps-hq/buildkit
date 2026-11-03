// No file here imports the package. Listing the reset entry point in `compilerOptions.types` applies ts-reset.
const parsed = JSON.parse("{}")
// @ts-expect-error ts-reset types JSON.parse as unknown
export const count: number = parsed

export const present: number[] = [1, undefined].filter(Boolean)
