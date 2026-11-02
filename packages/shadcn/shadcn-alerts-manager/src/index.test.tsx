import { Alert, AlertDescription, AlertTitle, Button, ShadcnLocalizationProvider } from "@buildkitgg/shadcn-baseui-kit"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { AlertRegion, alertComponents, createAlertManager } from "./index.js"
afterEach(cleanup)
it("inherits reactive region and dismissal labels with explicit override precedence", () => {
  const manager = createAlertManager()
  manager.info({ title: "Notice" })
  const view = render(
    <ShadcnLocalizationProvider strings={{ notifications: "Avis", dismiss: "Fermer" }}>
      <AlertRegion manager={manager} />
    </ShadcnLocalizationProvider>
  )
  expect(screen.getByRole("region", { name: "Avis" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy()
  view.rerender(
    <ShadcnLocalizationProvider strings={{ dismiss: "Schließen" }}>
      <AlertRegion manager={manager} dismissLabel="Custom" />
    </ShadcnLocalizationProvider>
  )
  expect(screen.getByRole("button", { name: "Custom" })).toBeTruthy()
})
it("renders native alerts, actions, intents, and localized dismissal", async () => {
  const manager = createAlertManager()
  const onAction = vi.fn<() => void>()
  render(<AlertRegion manager={manager} dismissLabel="Close notice" />)
  act(() => {
    manager.error({ title: "Failed", body: "Try again", action: { label: "Retry", onClick: onAction } })
    manager.info({ title: "Persistent", dismissible: false })
  })
  expect(screen.getByRole("alert").textContent).toContain("Failed")
  expect(screen.getByRole("status").textContent).toContain("Persistent")
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Retry" }))
  expect(onAction).toHaveBeenCalledOnce()
  // The default kit dismisses from the alert's corner, with an icon in place of the label
  expect(screen.getByRole("button", { name: "Close notice" }).textContent).toBe("")
  await user.click(screen.getByRole("button", { name: "Close notice" }))
  expect(manager.getSnapshot()).toHaveLength(1)
  expect(screen.queryByRole("button")).toBeNull()
})
it("keeps dismissal beside the action for registries without AlertAction", async () => {
  const manager = createAlertManager({
    adapter: alertComponents({ Alert, AlertTitle, AlertDescription, Button })
  })
  render(<AlertRegion manager={manager} dismissLabel="Close notice" />)
  act(() => {
    manager.warning({ title: "Review billing", action: { label: "Open billing", onClick: () => undefined } })
  })
  expect(screen.getByRole("button", { name: "Close notice" }).textContent).toBe("Close notice")
  await userEvent.setup().click(screen.getByRole("button", { name: "Close notice" }))
  expect(manager.getSnapshot()).toHaveLength(0)
})
it("accepts a custom adapter at the manager boundary", () => {
  function Alert() {
    return <p>Custom surface</p>
  }
  const manager = createAlertManager({ adapter: { Alert } })
  manager.add({})
  render(<AlertRegion manager={manager} />)
  expect(screen.getByText("Custom surface")).toBeTruthy()
})
