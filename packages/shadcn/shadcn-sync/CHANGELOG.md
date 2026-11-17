# Change Log - @buildkitgg/shadcn-sync

<!-- This log was last generated on Mon, 16 Nov 2026 13:35:03 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.1.4

Mon, 16 Nov 2026 13:35:03 GMT

### Patches

- Link sync's build dependencies correctly when the temp folder is reached through a link, as it is on macOS
  (ajcraswell@gmail.com)

## 0.1.3

Mon, 16 Nov 2026 12:43:35 GMT

### Patches

- Leave the stylesheet imports out of the generated declarations, so an app that type-checks its dependencies with
  skipLibCheck off doesn't fail on .css modules (ajcraswell@gmail.com)

## 0.1.2

Mon, 16 Nov 2026 10:11:33 GMT

### Patches

- Export hooks and lib with a swappable cn, add --css tailwind, and work under pnpm's isolated layout, npm, Yarn and Bun
  without @types/react (ajcraswell@gmail.com)

## 0.1.1

Mon, 16 Nov 2026 06:51:41 GMT

### Patches

- Publish shadcn-sync to npm (ajcraswell@gmail.com)
