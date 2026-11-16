// Plug'n'Play has no node_modules, where the generated package lives, and sync can't even load its own dependencies
// there, so it stops before importing anything that would fail with a confusing error.
if (process.versions.pnp) {
  process.stderr.write(
    "shadcn-sync doesn't work with Yarn's Plug'n'Play, because the generated package lives in node_modules. Add nodeLinker: node-modules to .yarnrc.yml, then run yarn install again.\n"
  )
  process.exitCode = 1
} else {
  const { runCli } = await import("./cli.js")

  await runCli()
}
