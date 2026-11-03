// What @buildkitgg/typescript-utils re-exports, and every choice made about it. `pnpm generate` turns this file into
// src/index.ts, reexports.json and AGENTS.md. Everything an upstream package exports is included unless it is listed
// in `exclusions` here, so new upstream exports arrive with each dependency update.

export type Upstream = {
  /** npm package name. */
  name: string
  /** Declaration file, relative to the package folder, that lists the package's public API. */
  types: string
  /** GitHub `owner/repo`. Release tags are `v<version>`. */
  repository: string
  /** Maps an export's declaration file in the published package to its source file in the repository. */
  source: (declaration: string, name: string) => string
  /** Upstream documentation page for an export, when the project publishes one per export. */
  docs?: (name: string, declaration: string) => string
  /** Exports re-exported under another name, such as a default export. */
  rename?: Record<string, string>
  /** The package has declarations only and no runtime entry point. */
  typesOnly?: boolean
}

export type Exclusion = {
  /** Export name in the upstream package. */
  name: string
  /** Upstream package name. */
  from: string
  /** Why it is left out. */
  reason: string
  /** What to use in its place. */
  instead: string
}

export const upstreams: Upstream[] = [
  {
    name: "es-toolkit",
    types: "dist/index.d.mts",
    repository: "toss/es-toolkit",
    source: (declaration) => declaration.replace(/^dist\//, "src/").replace(/\.d\.mts$/, ".ts"),
    docs: (name, declaration) => {
      const category = /^dist\/([^/]+)\//.exec(declaration)?.[1]

      return `https://es-toolkit.dev/reference/${category}/${name}.html`
    }
  },
  {
    name: "ts-extras",
    types: "distribution/index.d.ts",
    repository: "sindresorhus/ts-extras",
    source: (declaration) => declaration.replace(/^distribution\//, "source/").replace(/\.d\.ts$/, ".ts")
  },
  {
    name: "ts-pattern",
    types: "dist/index.d.ts",
    repository: "gvergnaud/ts-pattern",
    // API Extractor reports the namespace at its first use. It is declared in patterns.ts.
    source: (declaration, name) =>
      name === "P" ? "src/patterns.ts" : declaration.replace(/^dist\//, "src/").replace(/\.d\.ts$/, ".ts")
  },
  {
    name: "type-fest",
    types: "index.d.ts",
    repository: "sindresorhus/type-fest",
    source: (declaration) => declaration,
    typesOnly: true
  },
  {
    name: "tiny-invariant",
    types: "dist/tiny-invariant.d.ts",
    repository: "alexreardon/tiny-invariant",
    source: () => "src/tiny-invariant.ts",
    rename: { default: "invariant" }
  }
]

export const exclusions: Exclusion[] = [
  {
    name: "invariant",
    from: "es-toolkit",
    reason:
      "Buildkit standardizes on tiny-invariant, which accepts a lazy message and leaves the message out of production errors.",
    instead: "`invariant`, re-exported from tiny-invariant."
  },
  {
    name: "assert",
    from: "es-toolkit",
    reason: "An alias of es-toolkit's `invariant`. Its name also collides with `assert` from ts-extras.",
    instead: "`invariant`, re-exported from tiny-invariant."
  },
  {
    name: "assert",
    from: "ts-extras",
    reason: "Does the same job as `invariant`. One assertion function keeps narrowing consistent across a codebase.",
    instead: "`invariant`, re-exported from tiny-invariant."
  },
  {
    name: "Pattern",
    from: "ts-pattern",
    reason: "An alias of `P`, the name the ts-pattern documentation uses throughout.",
    instead: "`P`."
  }
]
