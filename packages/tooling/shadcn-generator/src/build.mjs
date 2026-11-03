import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { root, runBin } from "./shared.mjs"

// Compiles the sources sources.mjs wrote to .generated/ into dist/. It never reads a file it writes, which would keep
// Vite+ from caching it, so copies read and write rather than use copyFileSync, and dist/ is cleaned by pnpm generate.
const style = process.argv[2]
const directory = process.cwd()
const allowed = resolve(root, "packages/shadcn", `shadcn-baseui-${style}`)

if (directory !== allowed) {
  throw new Error("Unexpected build directory")
}

runBin("typescript", "tsc", ["-p", ".generated/tsconfig.json"], directory)

const copy = (from, to) => writeFileSync(resolve(directory, to), readFileSync(resolve(directory, from)))

copy(".generated/tokens.json", "dist/tokens.json")

for (const asset of ["theme.css", "tailwind.css", "animations.css", "shadcn.css"]) {
  copy(`.generated/${asset}`, `dist/${asset}`)
}

// Tailwind reads back a file it writes with -o, so it prints the sheet and this writes it.
for (const sheet of ["styles", "styles-no-reset"]) {
  const css = runBin("@tailwindcss/cli", "tailwindcss", ["-i", `.generated/${sheet}.css`, "--minify"], directory, {
    stdio: ["inherit", "pipe", "inherit"]
  })

  writeFileSync(resolve(directory, `dist/${sheet}.css`), css)
}
