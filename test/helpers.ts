import assert from 'node:assert/strict'
import { loadTs } from '../src/lib/typescript.ts'

if (!loadTs(import.meta.dirname)) throw new Error('tests need typescript installed in this repo')

export const eq = (got: unknown, want: unknown, label: string): void => {
  assert.equal(JSON.stringify(got), JSON.stringify(want), label)
}
