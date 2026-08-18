/**
 * The client bundle has to be reproducible, because `lib/` is committed: a git
 * install serves it, so a rebuild that changes bytes without a source change
 * turns every commit into a diff nobody can read.
 *
 * The one non-reproducible input found so far is the CSS Modules class map —
 * lightningcss returns it from a Rust HashMap, whose iteration order is
 * randomized per process, so consecutive builds of identical sources emitted
 * the same two classes in either order.
 */

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { pluginBundle } from '../scripts/tsdown-preset.ts'

/** The shape the preset's CSS plugin exposes to rolldown. */
interface CssPlugin {
  resolveId: (
    this: { resolve: () => Promise<{ id: string } | null> },
    source: string,
    importer: string | undefined,
  ) => Promise<string | null>
  load: (this: { addWatchFile: (file: string) => void }, id: string) => Promise<string | null>
}

/** Reach the `*.module.css` plugin out of the client half of the preset. */
function cssPlugin(): CssPlugin {
  const client = pluginBundle('dsh-plugin-mobile-shell', {
    host: ['src/index.ts'],
    client: 'src/client/index.tsx',
  })[1]
  const plugins = (client as { plugins?: unknown[] }).plugins ?? []
  const plugin = plugins.find(entry => (entry as { name?: string }).name === 'dsh-css-inline')
  expect(plugin).toBeDefined()
  return plugin as CssPlugin
}

/** Local class names in an order that is neither alphabetical nor reversed. */
const LOCALS = ['scrim', 'hamburger', 'drawer', 'rail', 'backdrop', 'title', 'row', 'chip']

/** Compile a stylesheet through the preset and return the emitted stub. */
async function compile(plugin: CssPlugin, file: string): Promise<string> {
  const virtualId = await plugin.resolveId.call(
    { resolve: () => Promise.resolve(null) },
    './sheet.module.css',
    file,
  )
  expect(virtualId).not.toBeNull()
  const code = await plugin.load.call({ addWatchFile: () => undefined }, virtualId as string)
  expect(code).not.toBeNull()
  return code as string
}

/** The `export default {…}` map the stub hands to the component. */
function classMap(code: string): Record<string, string> {
  const match = /export default (\{[\s\S]*\});$/.exec(code)
  expect(match).not.toBeNull()
  return JSON.parse((match as RegExpExecArray)[1] as string) as Record<string, string>
}

describe('client bundle reproducibility', () => {
  let plugin: CssPlugin
  let importer: string

  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-css-'))
    await writeFile(
      join(dir, 'sheet.module.css'),
      LOCALS.map(local => `.${local} { color: red; }`).join('\n'),
      'utf8',
    )
    importer = join(dir, 'component.tsx')
    plugin = cssPlugin()
  })

  it('emits the class map in a fixed (sorted) order', async () => {
    // Eight classes: an unsorted map would land in this order by chance about
    // once in 40320 runs, so this is a real assertion and not a coin flip.
    const map = classMap(await compile(plugin, importer))
    expect(Object.keys(map)).toEqual([...LOCALS].sort())
  })

  it('emits identical bytes for the same stylesheet twice', async () => {
    const first = await compile(plugin, importer)
    const second = await compile(plugin, importer)
    expect(second).toBe(first)
  })

  it('scopes every local name to a hashed class', async () => {
    const map = classMap(await compile(plugin, importer))
    // The hash itself is not asserted: it derives from the file path (a fresh
    // temp dir here) and its alphabet is lightningcss's business.
    for (const local of LOCALS) {
      expect(map[local]?.endsWith(`_${local}`)).toBe(true)
      expect(map[local]?.length).toBeGreaterThan(local.length + 1)
    }
  })
})
