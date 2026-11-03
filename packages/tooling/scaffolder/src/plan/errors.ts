import type { ErrorCode, PlanErrorInfo } from "./types.js"

const retryableCodes = new Set<ErrorCode>(["E_DRIFT", "E_LOCKED", "E_INTERRUPTED"])

/** A structured failure. The planner throws it internally and returns it as the plan's `error`. */
export class PlanError extends Error {
  readonly code: ErrorCode
  readonly paths: string[] | undefined
  readonly next: string[] | undefined

  constructor(code: ErrorCode, message: string, details: { paths?: string[]; next?: string[] } = {}) {
    super(message)
    this.name = "PlanError"
    this.code = code
    this.paths = details.paths
    this.next = details.next
  }

  toInfo(): PlanErrorInfo {
    const info: PlanErrorInfo = { code: this.code, message: this.message, retryable: retryableCodes.has(this.code) }

    if (this.paths) {
      info.paths = this.paths
    }

    if (this.next) {
      info.next = this.next
    }

    return info
  }
}

/** Describes anything a planner step threw. */
export function errorInfo(cause: unknown): PlanErrorInfo {
  if (cause instanceof PlanError) {
    return cause.toInfo()
  }

  const message = cause instanceof Error ? cause.message : String(cause)

  return { code: "E_INTERNAL", message, retryable: false }
}
