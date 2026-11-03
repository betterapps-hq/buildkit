import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { root, variants, readJson, writeJson } from "./shared.mjs"

const changeDirectory = resolve(root, "change")
const directories = variants().map((item) => item.directory)

const baseline = JSON.parse(
  execFileSync("git", ["show", "HEAD:packages/tooling/shadcn-generator/package-template.json"], {
    cwd: root,
    encoding: "utf8"
  })
)

const current = readJson(resolve(root, "packages/tooling/shadcn-generator/package-template.json"))

// Extractor references external prop types; it cannot prove that a dependency's major update is compatible.
for (const [name, range] of Object.entries(current.dependencies)) {
  if (range.startsWith("workspace:") && range === baseline.dependencies[name]) {
    continue
  }

  const before = baseline.dependencies[name]?.match(/^(?:\^|~)?(\d+)\.(\d+)\./)
  const after = range.match(/^(?:\^|~)?(\d+)\.(\d+)\./)

  if (!before || !after || before[1] !== after[1] || (after[1] === "0" && before[2] !== after[2])) {
    throw new Error(
      `Review dependency compatibility before releasing: ${name}: ${baseline.dependencies[name]} -> ${range}`
    )
  }
}

for (const directory of directories) {
  const pkg = readJson(resolve(directory, "package.json"))
  writeJson(resolve(changeDirectory, pkg.name.slice("@buildkitgg/".length) + "-upstream.json"), {
    type: "patch",
    comment: "Regenerate the component catalog from upstream and update supported dependencies.",
    packageName: pkg.name,
    email: "41898282+github-actions[bot]@users.noreply.github.com",
    dependentChangeType: "patch"
  })
}
