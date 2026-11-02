import { buttonVariants } from "@buildkitgg/shadcn-baseui-kit"
import { useSetting } from "./config"

export type Invoice = { id: string; issuedAt: string; total: number }

type Props = { invoices: Invoice[] }

export function InvoiceList({ invoices }: Props) {
  const { value: csvExport } = useSetting("csvExport")
  const { value: pageSize } = useSetting("pageSize")
  const { value: language } = useSetting("language")

  const date = new Intl.DateTimeFormat(language, { dateStyle: "medium" })
  const money = new Intl.NumberFormat(language, { style: "currency", currency: "EUR" })

  return (
    <>
      <header>
        <h2>Invoices</h2>
        {csvExport && (
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href="/api/invoices.csv" download>
            Export CSV
          </a>
        )}
      </header>
      <ul>
        {invoices.slice(0, pageSize).map((invoice) => (
          <li key={invoice.id}>
            <span>{date.format(new Date(invoice.issuedAt))}</span>
            <span>{money.format(invoice.total)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
