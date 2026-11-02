import { Button, Field, FieldLabel, Input } from "@buildkitgg/shadcn-baseui-kit"
import { AlertRegion } from "@buildkitgg/shadcn-alerts-manager"
import { useId, useTransition, type FormEvent } from "react"
import { alerts } from "./alerts"
import { updateProject, type Project } from "./api"

type Props = { project: Project }

export function ProjectSettings({ project }: Props) {
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
      <Button type="submit" disabled={saving}>Save</Button>
    </form>
  )
}
