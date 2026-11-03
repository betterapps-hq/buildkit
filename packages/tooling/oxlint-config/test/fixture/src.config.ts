import { defineConfig } from "oxlint"
import antiSlop from "../../src/anti-slop.ts"

export default defineConfig({ extends: [antiSlop] })
