# Maintenance

- [Usage](../README.md)
- [Architecture](../../../../docs/behavior-packages.md)

After a change, run `pnpm --filter @buildkitgg/react-preferences test:coverage`, then `pnpm verify`. Keep key and value
inference, atomic imports, isolated server snapshots, and disposal behavior intact. See the
[release workflow](../../../../docs/releases.md).
