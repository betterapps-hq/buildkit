#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { runScaffold } from "./cli/scaffold.js"

// SAFETY: the package.json beside dist ships with this package and always has a version.
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }

process.exitCode = await runScaffold(process.argv.slice(2), { version: manifest.version })
