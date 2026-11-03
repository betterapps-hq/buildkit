import { defineConfig } from "oxlint"
import antiSlop from "../../dist/anti-slop.js"

export default defineConfig({ extends: [antiSlop] })
