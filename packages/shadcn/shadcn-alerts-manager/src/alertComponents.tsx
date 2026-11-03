import type { AlertAdapter, AlertIntent, AlertRendererProps } from "@buildkitgg/react-alerts"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon, type LucideIcon } from "lucide-react"
import type { ComponentType, HTMLAttributes, ReactNode } from "react"

export type AlertComponents = {
  Alert: ComponentType<HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }>
  AlertTitle: ComponentType<{ children?: ReactNode }>
  AlertDescription: ComponentType<{ children?: ReactNode }>
  /** Holds the dismiss control at the alert's top end. Without it, dismissal sits beside the alert's action. */
  AlertAction?: ComponentType<{ children?: ReactNode }>
  Button: ComponentType<{
    children?: ReactNode
    type?: "button"
    variant?: "outline" | "ghost"
    size?: "sm" | "icon-sm"
    onClick?(): void
    "aria-label"?: string
  }>
}

const ICONS: Record<AlertIntent, LucideIcon> = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleAlertIcon
}

/**
 * The color each intent tints its alert with: the icon, the border and a wash over the card. Info stays neutral. Set
 * `--alert-success` or `--alert-warning` to match your theme; errors use the kit's destructive color.
 */
const TONES: Record<AlertIntent, string | null> = {
  info: null,
  success: "var(--alert-success, oklch(0.723 0.219 149.579))",
  warning: "var(--alert-warning, oklch(0.769 0.188 70.08))",
  error: "var(--destructive)"
}

/** Structural component contract works with Base UI and Radix shadcn registry components. */
export function alertComponents({
  Alert,
  AlertTitle,
  AlertDescription,
  AlertAction,
  Button
}: AlertComponents): AlertAdapter {
  function RenderAlert({ entry, dismiss, dismissLabel }: AlertRendererProps) {
    const Icon = ICONS[entry.intent]
    const tone = TONES[entry.intent]

    const action = entry.action && (
      <Button type="button" variant="outline" size="sm" onClick={entry.action.onClick}>
        {entry.action.label}
      </Button>
    )

    const dismissal = entry.dismissible && (
      <Button
        type="button"
        variant="ghost"
        size={AlertAction ? "icon-sm" : "sm"}
        aria-label={dismissLabel}
        onClick={dismiss}
      >
        {AlertAction ? <XIcon aria-hidden="true" /> : dismissLabel}
      </Button>
    )

    const inline = action || (!AlertAction && dismissal)

    return (
      <Alert
        role={entry.intent === "error" || entry.intent === "warning" ? "alert" : "status"}
        variant={entry.intent === "error" ? "destructive" : "default"}
        data-intent={entry.intent}
        style={
          tone
            ? {
                borderColor: `color-mix(in oklab, ${tone} 45%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${tone} 10%, var(--card))`
              }
            : undefined
        }
      >
        <Icon aria-hidden="true" style={tone ? { color: tone } : undefined} />
        <AlertTitle>{entry.title}</AlertTitle>
        {(entry.body || inline) && (
          <AlertDescription>
            {entry.body && <div>{entry.body}</div>}
            {inline && (
              <div className="mt-2 flex flex-wrap gap-2">
                {action}
                {!AlertAction && dismissal}
              </div>
            )}
          </AlertDescription>
        )}
        {AlertAction && dismissal && <AlertAction>{dismissal}</AlertAction>}
      </Alert>
    )
  }

  return { Alert: RenderAlert }
}
