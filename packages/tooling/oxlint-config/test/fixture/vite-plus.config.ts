import { defineConfig } from "vite-plus"
import antiSlop from "../../dist/anti-slop.js"

export default defineConfig({ lint: { extends: [antiSlop] } })
