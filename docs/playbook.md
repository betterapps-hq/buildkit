# Shared Playbook guidance

Shared rules, documentation and selected skills come from
[betterapps-hq/playbook](https://github.com/betterapps-hq/playbook). The package-manager lockfile pins Playbook to a
commit, and the `guidance` scripts sync from that installed copy. Skills follow their own update cycle through Vercel's
skills CLI.

| Script                                    | What it does                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm guidance:sync`                      | Regenerates the agent instructions and copies `best-practices/` from the installed Playbook package |
| `pnpm guidance:check`                     | Checks for drift without writing files                                                              |
| `pnpm guidance:update`                    | Updates the Playbook dependency, then regenerates guidance                                          |
| `pnpm skills:add <source> --skill <name>` | Installs selected skills through Vercel's skills CLI                                                |
| `pnpm skills:check`                       | Lists skill updates, exiting nonzero when there are some                                            |
| `pnpm skills:update`                      | Updates project skills from their recorded sources                                                  |
| `pnpm skills:remove <name>`               | Removes a skill                                                                                     |
| `pnpm skills:sync`                        | Restores the Playbook skill selection for Codex, Claude Code and GitHub Copilot on this checkout    |

Edit project instructions in `.rulesync/rules/90-project.md`, then run `pnpm guidance:sync`. Don't edit the generated
AGENTS.md, CLAUDE.md or .github/copilot-instructions.md directly. Shared rules live in Playbook. Keep project
documentation in `docs/`; shared documentation lives in `best-practices/`.

Commit the generated instructions, the shared docs, `.rulesync/playbook-docs.json`, and both the package-manager and
skills lockfiles. Shared-doc copying refuses local differences, so edit the source in Playbook or keep project-specific
content in a separate file. Skill updates may replace local edits. Review guidance and skill changes before merging.

Existing project rules remain authoritative for project-specific tooling and workflows.
[Playbook's sync guide](https://github.com/betterapps-hq/playbook/blob/main/docs/sync.md) documents the full setup.
