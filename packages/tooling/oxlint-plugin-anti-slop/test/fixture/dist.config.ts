import { defineConfig } from "oxlint"
import antiSlop from "../../dist/recommended.js"

export default defineConfig({ extends: [antiSlop] })
