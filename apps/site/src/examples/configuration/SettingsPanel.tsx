import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildkitgg/shadcn-baseui-kit"
import { RotateCcwIcon } from "lucide-react"
import { LANGUAGES, PAGE_SIZES, override, reset, useSetting, type Settings } from "./config"

// options only accepts that setting's values, so options={[30]} for pageSize is a type error
type SettingRowProps<K extends keyof Settings> = { name: K; options: readonly Settings[K][] }

function SettingRow<K extends keyof Settings>({ name, options }: SettingRowProps<K>) {
  const { value, source } = useSetting(name)

  function choose(next: Settings[K] | null) {
    if (next !== null) {
      override(name, next)
    }
  }

  return (
    <li>
      <code>{name}</code>
      <Select value={value} onValueChange={choose}>
        <SelectTrigger size="sm" aria-label={name}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={String(option)} value={option}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant={source === "override" ? "default" : "secondary"}>{source}</Badge>
      {source === "override" && (
        <Button variant="ghost" size="icon-sm" aria-label={`Reset ${name}`} onClick={() => reset(name)}>
          <RotateCcwIcon />
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
