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
  /** Packages the components import that the app doesn't have, which the installer can offer to install. */
  readonly missing: readonly string[]

  constructor(stage: SyncStage, message: string, previousKept = false, missing: readonly string[] = []) {
    super(message)
    this.name = "SyncError"
    this.stage = stage
    this.previousKept = previousKept
    this.missing = missing
  }

  /** The same failure, now known to have left the previous output alone. */
  keptPrevious(): SyncError {
    return this.previousKept ? this : new SyncError(this.stage, this.message, true, this.missing)
  }
}
