#!/usr/bin/env node
import { runMain } from "citty"
import { cli } from "./commands.js"

await runMain(cli)
