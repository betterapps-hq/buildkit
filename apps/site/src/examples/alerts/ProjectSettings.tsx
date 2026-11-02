import { AlertRegion, createAlertManager } from "@buildkitgg/shadcn-alerts-manager"
import { Button, Field, FieldLabel, Input } from "@buildkitgg/shadcn-baseui-kit"
import { useId, useTransition, type FormEvent } from "react"
import { updateProject, type Project } from "./api"

// One manager for the app. Each AlertRegion shows the alerts sent to its region.
export const alerts = createAlertManager()

export function ProjectSettings({ project }: { project: Project }) {
  const id = useId()
  const [saving, startSaving] = useTransition()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get("name"))

    startSaving(async () => {
      try {
        await updateProject(project.id, { name })
        alerts.success({ id: "save", title: "Project saved" }, "settings")
      } catch {
        // Same id as the success, so a retry replaces the error instead of stacking
        alerts.error({ id: "save", title: "Couldn't save the project" }, "settings")
      }
    })
  }

  return (
    <form onSubmit={save}>
      <Field>
        <FieldLabel htmlFor={id}>Project name</FieldLabel>
        <Input id={id} name="name" defaultValue={project.name} />
      </Field>
      <AlertRegion manager={alerts} region="settings" label="Project settings" />
      <Button type="submit" disabled={saving}>
        Save
      </Button>
    </form>
  )
}
