import { OPTIONS, type Choices, type Flag } from "../shadcnSyncOptions"

type OptionPickerProps = { choices: Choices; onChoose: (flag: Flag, value: string) => void }

/** A row of radio chips for each shadcn-sync option */
export function OptionPicker({ choices, onChoose }: OptionPickerProps) {
  return (
    <div className="kit-options">
      {OPTIONS.map((option) => (
        <fieldset key={option.flag} className="kit-option">
          <legend className="kit-option-label">
            {option.label}
            <code>--{option.flag}</code>
          </legend>
          <span className="kit-style-list">
            {option.values.map((value) => (
              <label key={value.id} className={choices[option.flag] === value.id ? "is-shown" : undefined}>
                <input
                  type="radio"
                  name={`shadcn-sync-${option.flag}`}
                  value={value.id}
                  checked={choices[option.flag] === value.id}
                  onChange={() => onChoose(option.flag, value.id)}
                />
                {value.label}
              </label>
            ))}
          </span>
        </fieldset>
      ))}
    </div>
  )
}
