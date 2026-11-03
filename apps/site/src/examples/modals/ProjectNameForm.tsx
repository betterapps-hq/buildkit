import { Button, Field, FieldLabel, Input } from "@buildkitgg/shadcn-baseui-kit"
import { createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"
import { useId, useState } from "react"

// Create one manager per app and mount its ModalRenderer once
export const modals = createModalManager()

export function ProjectNameForm({ savedName }: { savedName: string }) {
  const id = useId()
  const [name, setName] = useState(savedName)

  async function cancel() {
    const discard = await modals.confirm({
      title: "Discard changes?",
      description: "The new name hasn't been saved.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing"
    })

    if (discard) {
      setName(savedName)
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Project name</FieldLabel>
      <Input id={id} value={name} onChange={(event) => setName(event.target.value)} />
      <Button variant="outline" disabled={name === savedName} onClick={cancel}>
        Cancel
      </Button>
      <ModalRenderer manager={modals} />
    </Field>
  )
}
