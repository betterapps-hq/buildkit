import {
  Button,
  Combobox,
  ComboboxInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DirectionProvider,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@buildkitgg/shadcn"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

function DirectionExample() {
  const [isRtl, setIsRtl] = useState(false)
  const direction = isRtl ? "rtl" : "ltr"

  return (
    <DirectionProvider direction={direction}>
      <main dir={direction} style={{ padding: 24, display: "grid", gap: 20, maxWidth: 640 }}>
        <Button onClick={() => setIsRtl(!isRtl)}>Switch direction</Button>
        <Tabs defaultValue="first">
          <TabsList>
            <TabsTrigger value="first">First</TabsTrigger>
            <TabsTrigger value="second">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="first">First panel</TabsContent>
          <TabsContent value="second">Second panel</TabsContent>
        </Tabs>
        <Combobox defaultValue="Tea">
          <ComboboxInput aria-label="Drink" showClear />
        </Combobox>
        <Dialog>
          <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
          <DialogContent dir={direction}>
            <DialogTitle>Direction</DialogTitle>
            <DialogDescription>The dialog follows the reading direction.</DialogDescription>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger render={<Button />}>Open sheet</SheetTrigger>
          <SheetContent side={isRtl ? "right" : "left"} dir={direction}>
            <SheetTitle>Direction</SheetTitle>
            <SheetDescription>The sheet follows the reading direction.</SheetDescription>
          </SheetContent>
        </Sheet>
      </main>
    </DirectionProvider>
  )
}

const meta = { title: "shadcn/Direction", component: DirectionExample } satisfies Meta<typeof DirectionExample>

export default meta

type Story = StoryObj<typeof meta>

export const ReadingDirection: Story = { name: "Reading direction" }

export const Mobile: Story = {
  render: () => (
    <iframe
      title="Mobile direction example"
      src="./iframe.html?id=shadcn-direction--reading-direction&viewMode=story"
      style={{ width: 375, maxWidth: "100%", height: 720, border: 0 }}
    />
  )
}
