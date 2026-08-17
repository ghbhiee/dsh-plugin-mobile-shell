# Handoff — dsh-plugin-mobile-shell

Continuation brief for a fresh session working on this repo. Read this, then
`~/dsh/PLAN-dsh-plugins.md` (design + 34-item pitfall list, local machine
only, NOT in git) and `~/dsh/OPS-dsh.md` (install/restart runbook). Public
repo: keep secrets out.

## What this is

Narrow-viewport shell affordances for the DeepSeek Harness web UI, as an
out-of-tree plugin: a hamburger + scrim drawer for the sidebar, direction-
aware swipe to open/close, "tapping a group keeps the drawer open", and a
pinned document title. It replaced a set of hand-applied patches to dsh's
compiled bundle. This repo is the standalone development home (split out of
the old `dsh-plugins` monorepo). Siblings: `dsh-plugin-workbench`,
`dsh-plugin-cli-session`.

## Architecture

- `src/index.ts` — host half: serves `/plugins/mobile-shell/config`
  (`narrowMaxWidth`, `documentTitle`) because a client entry never sees its
  row's config.
- `src/client/NarrowShell.tsx` — everything lives in the `shell.overlay` seat
  and drives the sidebar through `ctx.layout.toggleSidebar()`. The drawer
  geometry is `narrow-shell.css`, a global stylesheet keyed on the frame's
  stable data attributes (`data-mobile-shell-narrow`, set by the component
  from a ResizeObserver measurement of the frame — NOT a media query) and
  structural child selectors.

## Hard constraints

- Only `--dsw-alias-*` tokens + stable data attributes; never hash class
  names. `data-sidebar-collapsed` is ABSENT when open (React drops false
  data-* values) — selectors must use `:not([data-sidebar-collapsed='true'])`.
- Client bundle contract replicated in `scripts/tsdown-preset.ts` (CJS in
  `window.__ModuleLoader__.load`, 10 externals, CSS inlined). No new externals.
- Narrow detection measures the frame box via ResizeObserver (media-query
  `change` events can silently miss devtools emulation / pane resizes);
  `clientWidth === 0` means "hidden, keep the last decision".
- **lib/ is committed** (bare `github:ghbhiee/dsh-plugin-mobile-shell`
  installs serve it): rebuild + commit lib/ on every change, built from THIS
  repo's checkout.

## Build / verify loop

```sh
pnpm install
pnpm run check      # typecheck → vitest (23 tests) → tsdown build
```

Local deployment (this Mac): the dsh `web` profile links to this clone, so
`pnpm run build && launchctl kickstart -k gui/$(id -u)/com.tokencv.dsh-web`,
then verify at http://127.0.0.1:3080 with a narrow viewport (hamburger +
drawer). CI = `pnpm install --frozen-lockfile && pnpm run check`.
