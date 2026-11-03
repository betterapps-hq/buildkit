// An app that isn't an ES module: Vite compiles this config to CommonJS and loads the plugin package with `require`.
import antiSlop from "@buildkitgg/oxlint-plugin-anti-slop/recommended"
import { defineConfig } from "vite-plus"
import base from "../../../dist/base.js"

export default defineConfig({ lint: { extends: [base, antiSlop] } })
