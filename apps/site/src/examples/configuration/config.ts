import { createConfiguration } from "@buildkitgg/react-configuration"

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
  provider: {
    async load({ environment, orgId }, { signal }) {
      const response = await fetch(`/api/orgs/${orgId}/settings?environment=${environment}`, { signal })
      return response.json()
    }
  },
  // Checked at runtime too, so a page size or language outside these lists is rejected
  validate: {
    pageSize: (size) => PAGE_SIZES.includes(size),
    language: (language) => LANGUAGES.includes(language)
  },
  // Local overrides only exist in development builds
  overrides: import.meta.env.DEV && { storage: "localStorage", key: "settings" }
})

refresh()
