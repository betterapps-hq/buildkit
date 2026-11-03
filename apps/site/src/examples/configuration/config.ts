import { createConfiguration } from "@buildkitgg/react-configuration"
import { fetchSettings } from "./api"

export const PAGE_SIZES = [25, 50, 100] as const
export const LANGUAGES = ["en", "fr", "de"] as const

// useSetting("language").value is "en" | "fr" | "de", and override only accepts those
export type Settings = {
  csvExport: boolean
  pageSize: (typeof PAGE_SIZES)[number]
  language: (typeof LANGUAGES)[number]
}

const defaults: Settings = { csvExport: false, pageSize: 25, language: "en" }

export const { useSetting, override, reset, refresh } = createConfiguration({
  defaults,
  context: { environment: "production", orgId: "contoso" },
  provider: { load: fetchSettings },
  // Local overrides only exist in development builds
  overrides: import.meta.env.DEV && { storage: "localStorage", key: "settings" }
})

refresh()
