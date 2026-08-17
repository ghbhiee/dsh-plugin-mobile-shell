/**
 * Documentation drift, caught mechanically: the README is the only
 * description of this plugin's contract, so read it here instead of hoping.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8')

/** Config field names the schema declares, in source order. */
function schemaFields(source: string): string[] {
  const block = /export const Config: z<Config> = z\.object\(\{([\s\S]*?)\n\}\)/.exec(source)
  if (block === null) return []
  return [...(block[1] as string).matchAll(/^\s{2}(\w+):/gm)].map(match => match[1] as string)
}

describe('mobile-shell', () => {
  const readme = read('README.md')
  const index = read('src', 'index.ts')

  it('documents every config field', () => {
    const fields = schemaFields(index)
    expect(fields).toEqual(['narrowMaxWidth', 'documentTitle'])
    const undocumented = fields.filter(field => !readme.includes(field))
    expect(undocumented).toEqual([])
  })
})
