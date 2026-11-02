export type Project = { id: string; name: string }

export async function updateProject(id: string, changes: Partial<Omit<Project, "id">>) {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  })
  if (!response.ok) {
    throw new Error(`Couldn't update project ${id}: ${response.status}`)
  }
  return (await response.json()) as Project
}
