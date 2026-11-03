import { useEffect } from "react"
import { refresh, useSetting } from "../examples/configuration/config"
import { InvoiceList } from "../examples/configuration/InvoiceList"
import { SettingsPanel } from "../examples/configuration/SettingsPanel"
import { format, onCommand, report } from "./bridge"
import { INVOICES } from "./server"

onCommand((command) => {
  if (command === "refresh") {
    refresh()
  }
})

function Wire() {
  const { value, source } = useSetting("language")
  useEffect(() => {
    report({ wire: [{ label: 'useSetting("language")', value: format({ value, source }), tone: "plain" }] })
  }, [value, source])

  return null
}

export function Example() {
  return (
    <>
      <section className="frame-part">
        <p className="frame-caption">{"<InvoiceList />"}</p>
        <InvoiceList invoices={INVOICES} />
      </section>
      <section className="frame-part">
        <p className="frame-caption">{"<SettingsPanel />"}</p>
        <SettingsPanel />
      </section>
      <Wire />
    </>
  )
}
