import path from "node:path"
import { loadConfig } from "c12"
import type { z } from "zod"

/** c12 is deliberately limited to the selected local file. What the file exports is checked against `schema`. */
export async function readConfigFile<T>(file: string, schema: z.ZodType<T>) {
  const { config } = await loadConfig({
    cwd: path.dirname(file),
    configFile: file,
    configFileRequired: true,
    name: "dev-domains",
    dotenv: false,
    rcFile: false,
    globalRc: false,
    packageJson: false,
    envName: false,
    omit$Keys: false,
    extend: false,
    giget: false
  })

  return schema.safeParse(config)
}
