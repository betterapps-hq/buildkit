import { createAlertManager } from "@buildkitgg/shadcn-alerts-manager"

// One manager for the app. Each AlertRegion shows the alerts sent to its region.
export const alerts = createAlertManager()
