import { Link, useLoaderData, useParams } from "react-router"
import { PersonPanel } from "./PersonPanel"

export type Person = { id: string; name: string; role: string }

export async function loader() {
  const response = await fetch("/api/people")
  if (!response.ok) {
    throw new Response("Couldn't load people", { status: response.status })
  }
  return (await response.json()) as Person[]
}

export function Component() {
  const people = useLoaderData<typeof loader>()
  const { personId } = useParams()
  const selected = people.find((person) => person.id === personId)
  return (
    <>
      <ul>
        {people.map((person) => (
          <li key={person.id}>
            <Link to={`/people/${person.id}`}>{person.name}</Link>
            <p>{person.role}</p>
          </li>
        ))}
      </ul>
      {selected && <PersonPanel person={selected} />}
    </>
  )
}
