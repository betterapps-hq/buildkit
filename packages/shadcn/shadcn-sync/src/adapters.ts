import { join } from "node:path"
import * as z from "zod"
import { readJson } from "./json.js"
import { findPackage } from "./resolve.js"

/** The `package.json` keyword that marks an icon adapter, so the installer can list adapters without a fixed list. */
export const adapterKeyword = "shadcn-sync-icons"

/** An icon adapter the installer can offer. */
export interface AdapterChoice {
  readonly name: string
  readonly description?: string | undefined
}

const keywordsSchema = z.looseObject({
  description: z.string().optional(),
  keywords: z.array(z.string()).optional()
})

const appSchema = z.looseObject({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional()
})

/** The app's dependencies whose `package.json` carries the adapter keyword. */
export function installedAdapters(appDirectory: string): AdapterChoice[] {
  const app = readJson(join(appDirectory, "package.json"), appSchema)

  return Object.keys({ ...app.dependencies, ...app.devDependencies })
    .toSorted()
    .flatMap((name) => {
      const directory = findPackage(name, appDirectory)
      const manifest = directory ? readJson(join(directory, "package.json"), keywordsSchema) : undefined

      return manifest?.keywords?.includes(adapterKeyword) ? [{ name, description: manifest.description }] : []
    })
}

const searchSchema = z.object({
  objects: z.array(z.object({ package: z.object({ name: z.string(), description: z.string().optional() }) }))
})

/** Adapters published to npm with the keyword. Gives up quietly offline or when npm is slow. */
export async function publishedAdapters(): Promise<AdapterChoice[]> {
  try {
    const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=keywords:${adapterKeyword}&size=20`, {
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) {
      return []
    }

    return searchSchema
      .parse(await response.json())
      .objects.map(({ package: found }) => ({ name: found.name, description: found.description }))
  } catch {
    return []
  }
}
