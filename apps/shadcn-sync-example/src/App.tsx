import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Label,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch
} from "@buildkitgg/shadcn"
import { useState } from "react"

const regions = [
  { label: "Choose a region", value: null },
  { label: "North America", value: "na" },
  { label: "Europe", value: "eu" },
  { label: "Asia Pacific", value: "apac" }
]

export function App() {
  const [notifications, setNotifications] = useState(true)
  const [compact, setCompact] = useState(false)

  return (
    <main className="app-page">
      <header className="app-header">
        <h1>Workspace settings</h1>
        <p>
          Components from <code>@buildkitgg/shadcn</code>, built by <code>shadcn-sync sync</code>. This app has no
          Tailwind.
        </p>
      </header>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="app-grid">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How your name appears to your team.</CardDescription>
          </CardHeader>
          <CardContent className="app-stack">
            <Field>
              <FieldLabel htmlFor="name">Display name</FieldLabel>
              <Input id="name" defaultValue="Robin Park" />
              <FieldDescription>Use the name your team knows you by.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="region">Region</FieldLabel>
              <Select items={regions}>
                <SelectTrigger id="region" className="app-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {regions.map((region) => (
                      <SelectItem key={region.label} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
          <CardFooter className="app-row">
            <Button>Save profile</Button>
            <Button variant="outline">Cancel</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Choose what Workspace sends you. <Badge variant="secondary">Beta</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="app-stack">
            <div className="app-row">
              <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
              <Label htmlFor="notifications">Email notifications</Label>
            </div>
            <div className="app-row">
              <Checkbox id="compact" checked={compact} onCheckedChange={setCompact} />
              <Label htmlFor="compact">Compact layout</Label>
            </div>
            <Alert>
              <AlertTitle>Weekly summary</AlertTitle>
              <AlertDescription>Summaries go out every Monday morning.</AlertDescription>
            </Alert>
            <div className="app-row">
              <Spinner />
              <span className="app-muted">Syncing preferences</span>
            </div>
          </CardContent>
          <CardFooter className="app-row">
            <Dialog>
              <DialogTrigger render={<Button variant="destructive" />}>Delete workspace</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this workspace?</DialogTitle>
                  <DialogDescription>{"Everyone loses access to its projects. You can't undo this."}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Keep workspace</DialogClose>
                  <Button variant="destructive">Delete workspace</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>Options</DropdownMenuTrigger>
              <DropdownMenuContent className="app-menu">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuItem>Rename</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={compact} onCheckedChange={setCompact}>
                  Compact layout
                </DropdownMenuCheckboxItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>Design team</DropdownMenuItem>
                    <DropdownMenuItem>Platform team</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardFooter>
        </Card>
      </div>

      <Accordion defaultValue={["billing"]}>
        <AccordionItem value="billing">
          <AccordionTrigger>Who can see billing?</AccordionTrigger>
          <AccordionContent>Only workspace owners can see invoices and payment details.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="export">
          <AccordionTrigger>Can I export my data?</AccordionTrigger>
          <AccordionContent>Owners can export every project as a ZIP file from this page.</AccordionContent>
        </AccordionItem>
      </Accordion>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </main>
  )
}
