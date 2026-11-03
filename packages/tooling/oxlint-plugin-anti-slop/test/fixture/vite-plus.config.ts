import { defineConfig } from "vite-plus"
import antiSlop from "../../dist/recommended.js"

export default defineConfig({ lint: { extends: [antiSlop] } })
