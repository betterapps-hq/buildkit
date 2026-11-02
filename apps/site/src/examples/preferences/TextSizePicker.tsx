import { createPreferences, usePreference } from "@buildkitgg/react-preferences"
import { Button, ButtonGroup } from "@buildkitgg/shadcn-baseui-kit"

const TEXT_SIZES = { Small: 14, Medium: 16, Large: 18 }

const preferences = createPreferences({
  defaults: { textSize: 16 },
  storage: "localStorage", // Saved in this browser and synced across its tabs
  key: "preferences"
})

// Works outside React too: set the page's text size now, and again on every change
function applyTextSize() {
  document.documentElement.style.setProperty("--text-size", `${preferences.get("textSize")}px`)
}
applyTextSize()
preferences.subscribe(applyTextSize)

export function TextSizePicker() {
  const [textSize, setTextSize] = usePreference(preferences, "textSize")
  return (
    <>
      <ButtonGroup aria-label="Text size">
        {Object.entries(TEXT_SIZES).map(([label, size]) => (
          <Button
            key={size}
            variant={size === textSize ? "default" : "outline"}
            aria-pressed={size === textSize}
            onClick={() => setTextSize(size)}
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>
      <p>Text across the page follows the size you pick, in this tab and every other one.</p>
    </>
  )
}
