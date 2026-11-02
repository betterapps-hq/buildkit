import type { Settings } from "./config"

type Context = { environment: string; orgId: string }

export async function fetchSettings({ environment, orgId }: Context, { signal }: { signal: AbortSignal }) {
  const response = await fetch(`/api/orgs/${orgId}/settings?environment=${environment}`, { signal })
  if (!response.ok) {
    throw new Error(`Couldn't load settings for ${orgId}: ${response.status}`)
  }
  return (await response.json()) as Partial<Settings>
}
