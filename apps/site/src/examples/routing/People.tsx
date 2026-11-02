import { Link, useParams } from "react-router"
import { PersonPanel } from "./PersonPanel"

export type Person = { id: string; name: string; role: string }

const PEOPLE: Person[] = [
  { id: "1042", name: "Ada Park", role: "Product designer" },
  { id: "1043", name: "Jamie Chen", role: "Frontend engineer" }
]

export function Component() {
  const { personId } = useParams()
  const selected = PEOPLE.find((person) => person.id === personId)

  return (
    <>
      <ul>
        {PEOPLE.map((person) => (
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
