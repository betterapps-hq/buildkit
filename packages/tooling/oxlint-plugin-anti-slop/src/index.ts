// The anti-slop Oxlint plugin, for `jsPlugins`. Its rules are named `anti-slop/<rule>`.
import plugin from "./vendor/anti-slop/index.ts"

export default plugin

// What `require` returns, so a config compiled to CommonJS gets the plugin rather than this module's namespace.
export { plugin as "module.exports" }
