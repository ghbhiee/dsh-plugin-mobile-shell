# Handoff — dsh-plugin-mobile-shell

Continuation brief for a fresh session working on this repo. Read this, then
`~/dsh/PLAN-dsh-plugins.md` (design + 34-item pitfall list, local machine
only, NOT in git) and `~/dsh/OPS-dsh.md` (install/restart runbook). Public
repo: keep secrets out.


## Working agreement — git is the source of truth

This repo is edited from more than one place: a parked continuation session for
this repo, and whichever session the user happens to be in. That drifted once —
the same repo had uncommitted work in one place while another session was
building on top of it — so:

**Commit and push as soon as a change is finished. Do not leave finished work
sitting uncommitted, and never assume the working tree is what git has.**

Before starting anything: `git pull` (or at minimum `git status && git log --oneline -3`).
Whatever is on `main` is what everyone else — and every `github:` install —
sees. `lib/` is committed here, so it must be rebuilt and committed with the
source in the same commit, or a git install serves stale code.

The bundle is byte-reproducible (the preset sorts lightningcss's CSS Modules
export map), so a `lib/` diff always means a real change — treat an unexpected
one as a signal, not noise.

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
- The client bundle is **byte-reproducible** within a checkout, so a `lib/`
  diff always means a real change. It was not: lightningcss returns the CSS
  Modules export map from a Rust HashMap with per-process iteration order, so
  the class map came out in either order and every other rebuild produced a
  phantom diff. `scripts/tsdown-preset.ts` sorts it now, guarded by
  `tests/build-preset.spec.ts`. **The sibling repos carry their own copy of
  the preset and still have the unsorted version** — workbench has several
  CSS modules, so it churns more.

## Build / verify loop

```sh
pnpm install
pnpm run check      # typecheck → vitest (26 tests) → tsdown build
```

Local deployment (this Mac): the dsh `web` profile links to this clone, so
`pnpm run build && launchctl kickstart -k gui/$(id -u)/com.tokencv.dsh-web`,
then verify at http://127.0.0.1:3080 with a narrow viewport (hamburger +
drawer). CI = `pnpm install --frozen-lockfile && pnpm run check`.

**Verifying narrow ⇄ wide in an automated browser**: a viewport resize looks
like it does nothing while the browser pane is not rendering — `ResizeObserver`
callbacks and `resize` events are withheld until the page paints again, so the
plugin sits on its last decision (which is the intended behaviour, the same one
`clientWidth === 0` protects, but it reads exactly like the detection being
broken). Force a paint (take a screenshot) or dispatch a `resize` event before
asserting anything about the transition; measuring `clientWidth` alone does not
un-freeze it, because a property read forces layout without a frame.
