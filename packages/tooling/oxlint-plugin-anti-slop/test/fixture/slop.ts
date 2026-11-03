export const total = [1, 2, 3].filter((value) => value > 1).map((value) => value * 2)

export function describe(value: unknown) {
  return typeof value === "string" ? value : String(value)
}

export const merged = [{ a: 1 }].reduce((all, item) => ({ ...all, ...item }), {})
