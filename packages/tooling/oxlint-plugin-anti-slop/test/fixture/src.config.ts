import { defineConfig } from "oxlint"
import antiSlop from "../../src/recommended.ts"

export default defineConfig({ extends: [antiSlop] })
