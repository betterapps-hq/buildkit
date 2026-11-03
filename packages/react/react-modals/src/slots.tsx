import { createElement } from "react"
import type { ModalDefaultFooterProps, ModalSlot } from "./types.js"

export function renderSlot<TProps extends object>(slot: ModalSlot<TProps>, props: TProps) {
  if (slot instanceof Object && "component" in slot) {
    return createElement(slot.component, props)
  }

  return slot
}

/** Custom adapters can supply their own native helper buttons. Consumer footers bypass this component. */
export function DefaultFooter({ kind, labels, isPending, dismiss, confirm }: ModalDefaultFooterProps) {
  return (
    <>
      <button type="button" disabled={isPending} onClick={dismiss}>
        {kind === "confirm" ? labels.cancel : labels.close}
      </button>
      {kind === "confirm" && (
        <button type="button" disabled={isPending} onClick={confirm}>
          {labels.confirm}
        </button>
      )}
    </>
  )
}

export function validateName({ title, ariaLabel }: { title: unknown; ariaLabel?: string }) {
  if (ariaLabel !== undefined && !ariaLabel.trim()) {
    throw new Error("ariaLabel must be non-empty when supplied")
  }

  const isMissingTitle =
    title === null ||
    title === undefined ||
    title === true ||
    title === false ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a title can be any slot, and only a string one can be blank
    (typeof title === "string" && !title.trim())

  if (isMissingTitle && !ariaLabel?.trim()) {
    throw new Error("A modal needs a title or a non-empty ariaLabel")
  }
}
