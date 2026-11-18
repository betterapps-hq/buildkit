# Maintenance

- [Usage](../README.md)
- [Architecture](../../../../docs/behavior-packages.md)

Build with `pnpm --filter @buildkitgg/react-theme build`. Run the focused tests, then `pnpm verify`. Keep tests covering
stable snapshots, disposal, and server isolation, and pack only compiled exports and declarations. See the
[release workflow](../../../../docs/releases.md).
