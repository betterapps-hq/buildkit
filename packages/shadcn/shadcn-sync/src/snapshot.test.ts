import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { compareSnapshots, createSnapshot, readSnapshot, writeSnapshot } from "./snapshot.js"

const responses = {
  "styles/base-nova/select.json": { name: "select", files: [] },
  "colors/neutral.json": { cssVarsV4: { light: {}, dark: {} } }
}

describe("registry snapshot", () => {
  it("sorts responses and survives reformatting, but not edits", () => {
    const directory = mkdtempSync(join(tmpdir(), "shadcn-sync-snapshot-"))
    const path = join(directory, "shadcn-registry.json")
    const snapshot = createSnapshot("base-nova", "neutral", "4.23.0", responses)

    expect(Object.keys(snapshot.responses)).toEqual(["colors/neutral.json", "styles/base-nova/select.json"])
    expect(readSnapshot(path)).toBeUndefined()

    writeSnapshot(path, snapshot)
    expect(readSnapshot(path)).toEqual(snapshot)

    // A formatter that reindents the file keeps the hash valid.
    writeFileSync(path, JSON.stringify(JSON.parse(readFileSync(path, "utf8")), null, 4))
    expect(readSnapshot(path)?.hash).toBe(snapshot.hash)

    writeFileSync(path, readFileSync(path, "utf8").replace('"select"', '"combobox"'))
    expect(() => readSnapshot(path)).toThrow("shadcn-registry.json was edited by hand.")

    writeFileSync(path, "{}")
    expect(() => readSnapshot(path)).toThrow("edited by hand")
  })

  it("lists the items an update added, removed or changed", () => {
    const before = createSnapshot("base-nova", "neutral", "4.23.0", responses)

    const after = createSnapshot("base-nova", "neutral", "4.23.0", {
      "colors/neutral.json": { cssVarsV4: { light: { radius: "1rem" }, dark: {} } },
      "styles/base-nova/combobox.json": { name: "combobox" }
    })

    expect(compareSnapshots(before, after)).toEqual({
      added: ["styles/base-nova/combobox.json"],
      removed: ["styles/base-nova/select.json"],
      changed: ["colors/neutral.json"]
    })
    expect(compareSnapshots(undefined, before).added).toHaveLength(2)
  })
})
