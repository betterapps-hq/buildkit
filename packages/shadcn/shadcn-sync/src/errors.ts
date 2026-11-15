/** The pipeline stage a failure belongs to. */
export type SyncStage =
  | "configuration"
  | "registry"
  | "dependency"
  | "installation"
  | "compilation"
  | "css"
  | "registration"

/** A failure the CLI reports with its stage and exits nonzero for. */
export class SyncError extends Error {
  readonly stage: SyncStage
  /** Whether the failure happened before the swap, so the previous output is still in place. */
  readonly previousKept: boolean

  constructor(stage: SyncStage, message: string, previousKept = false) {
    super(message)
    this.name = "SyncError"
    this.stage = stage
    this.previousKept = previousKept
  }

  /** The same failure, now known to have left the previous output alone. */
  keptPrevious(): SyncError {
    return this.previousKept ? this : new SyncError(this.stage, this.message, true)
  }
}
