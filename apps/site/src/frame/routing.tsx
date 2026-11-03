import { RouterProvider } from "react-router"
import { people, router, settings } from "../examples/routing/router"
import { format, onCommand, report, toneOf } from "./bridge"

// Where the frame is in its own history, for the preview bar's Back and Forward
let index = 0
let length = 1
let step = 0
let key = router.state.location.key

function activeTab() {
  if (people.isActive()) {
    return "people"
  }

  if (settings.isActive()) {
    return "settings"
  }

  return undefined
}

function show() {
  const { pathname, search } = router.state.location
  const tab = activeTab()
  report({
    wire: [
      { label: "tabs.activeTab", value: format(tab), tone: toneOf(tab) },
      { label: "panel.isOpen", value: String(/^\/people\/[^/]+$/.test(pathname)), tone: "keyword" }
    ],
    route: { path: pathname + search, canGoBack: index > 0, canGoForward: index < length - 1 }
  })
}

router.subscribe((state) => {
  if (state.location.key !== key) {
    key = state.location.key

    if (state.historyAction === "PUSH") {
      index += 1
      length = index + 1
    } else if (state.historyAction === "POP") {
      index += step
    }

    step = 0
  }

  show()
})

onCommand((command) => {
  if (command === "back" && index > 0) {
    step = -1
    router.navigate(-1)
  } else if (command === "forward" && index < length - 1) {
    step = 1
    router.navigate(1)
  }
})

show()

export function Example() {
  return <RouterProvider router={router} />
}
