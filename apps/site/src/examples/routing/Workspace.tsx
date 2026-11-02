import { useRouteTabs } from "@buildkitgg/react-router"
import { Tabs, TabsList, TabsTrigger } from "@buildkitgg/shadcn-baseui-kit"
import { Outlet } from "react-router"
import { adapter, people, settings } from "./router"

// The layout route: its tabs follow the URL, and the page renders in the outlet
export function Component() {
  const tabs = useRouteTabs(adapter, {
    tabs: [
      { id: "people", route: people },
      { id: "settings", route: settings }
    ]
  })

  return (
    <Tabs value={tabs.activeTab} onValueChange={tabs.select}>
      <TabsList>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <Outlet />
    </Tabs>
  )
}
