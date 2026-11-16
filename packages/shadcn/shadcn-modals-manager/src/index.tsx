"use client"

import {
  createModalManager as createReactModalManager,
  ModalRenderer as ReactModalRenderer
} from "@buildkitgg/react-modals"
import type { ModalManagerOptions, ModalSurfaceOptions } from "@buildkitgg/react-modals"
import { Button } from "@buildkitgg/shadcn/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@buildkitgg/shadcn/dialog"
import { baseUiComponents } from "./baseUiComponents.js"
import type { ModalManager, ModalRendererProps } from "./types.js"

const defaultAdapter = baseUiComponents({ Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle })

export function createModalManager(options?: ModalManagerOptions): ModalManager {
  return createReactModalManager<ModalSurfaceOptions>({ ...options, adapter: options?.adapter ?? defaultAdapter })
}

/** Renders the manager's adapter. Default components bring their own CSS from the app's `@buildkitgg/shadcn`. */
export function ModalRenderer(props: ModalRendererProps) {
  return <ReactModalRenderer {...props} />
}

export { baseUiComponents } from "./baseUiComponents.js"

export { radixComponents } from "./radixComponents.js"

export type {
  ModalManager,
  ModalRendererProps,
  ModalAdapter,
  BaseUiModalComponents,
  RadixModalComponents
} from "./types.js"

export { useModals } from "@buildkitgg/react-modals"

export type {
  ModalSlotProps,
  ModalControls,
  ModalHandle,
  ModalDefinition,
  ModalLabels,
  ModalManagerOptions,
  ModalSurfaceOptions,
  ModalStateUpdate,
  ModalSlot,
  ModalSlots,
  ModalRenderedSlots,
  ModalDefaultFooterProps,
  StandardModalSlotProps,
  StandardModalOptions,
  ModalCloseEvent,
  ModalCloseReason,
  ModalState,
  ModalUpdate,
  StandardModalHandle,
  CreateModalOptions
} from "@buildkitgg/react-modals"
