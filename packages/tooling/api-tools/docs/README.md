# API tooling

This private workspace runs Microsoft API Extractor on the compiled declarations of the packages under `packages/`, with
one shared configuration. It finds each package's public entry points in its `package.json` exports, and stops if a
package has no explicit exports. See the [API report workflow](../../../../api-reports/README.md).

The extractor reads declarations with its own supported TypeScript compiler, while packages keep compiling with the
repository's TypeScript. It doesn't bundle or rewrite the declarations packages ship.

One warning is allowed. Redux Toolkit ships `dist/uncheckedindexed.ts` behind a declaration import, and the extractor's
wrong-input-extension notice for that exact file is informational. The same warning for any of our files fails the
check. Exports without doc comments show as `(undocumented)` in the reports and don't fail it.
