import { Badge, Button, ButtonGroup } from "@buildkitgg/shadcn-baseui-kit"
import { LANGUAGES, PAGE_SIZES, override, reset, useSetting, type Settings } from "./config"

// options only accepts that setting's values, so options={[30]} for pageSize is a type error
type SettingRowProps<K extends keyof Settings> = { name: K; options: readonly Settings[K][] }

function SettingRow<K extends keyof Settings>({ name, options }: SettingRowProps<K>) {
  const { value, source } = useSetting(name)
  return (
    <li>
      <code>{name}</code>
      <ButtonGroup aria-label={name}>
        {options.map((option) => (
          <Button
            key={String(option)}
            size="sm"
            variant={option === value ? "default" : "outline"}
            onClick={() => override(name, option)}
          >
            {String(option)}
          </Button>
        ))}
      </ButtonGroup>
      <Badge variant="outline">{source}</Badge>
      {source === "override" && (
        <Button variant="ghost" size="sm" onClick={() => reset(name)}>
          Reset
        </Button>
      )}
    </li>
  )
}

// A development panel, since overrides only exist in dev builds
export function SettingsPanel() {
  return (
    <ul>
      <SettingRow name="csvExport" options={[false, true]} />
      <SettingRow name="pageSize" options={PAGE_SIZES} />
      <SettingRow name="language" options={LANGUAGES} />
    </ul>
  )
}
