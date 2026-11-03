import { resolve } from "node:path"
import { generateSources } from "./generate.mjs"
import { root } from "./shared.mjs"

// The first half of a style package's build: it writes .generated/, which build.mjs then compiles. They run as two
// commands so Vite+ can cache each one; a single command that reads files it wrote is never cached.
const style = process.argv[2]
const directory = process.cwd()

if (directory !== resolve(root, "packages/shadcn", `shadcn-baseui-${style}`)) {
  throw new Error("Unexpected build directory")
}

await generateSources(style, directory, { clean: false })
