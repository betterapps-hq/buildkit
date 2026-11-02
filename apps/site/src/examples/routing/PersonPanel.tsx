import { useRoutePanel } from "@buildkitgg/react-router"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@buildkitgg/shadcn-baseui-kit"
import type { Person } from "./People"
import { adapter, people } from "./router"

type Props = { person: Person }

export function PersonPanel({ person }: Props) {
  const panel = useRoutePanel(adapter, {
    route: adapter.route({ to: `/people/${person.id}` }),
    // Back to the list, even when a shared link opened this panel
    closeTo: people
  })
  return (
    <Sheet open={panel.isOpen} onOpenChange={panel.setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{person.name}</SheetTitle>
          <SheetDescription>{person.role}</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}
