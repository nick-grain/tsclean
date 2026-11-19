import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type * as TS from 'typescript'

export type { TS }

export let ts: typeof TS

const ancestors = (dir: string): string[] => {
  const out: string[] = []
  for (let d = dir; ; d = dirname(d)) {
    out.push(d)
    if (dirname(d) === d) return out
  }
}

export const loadTs = (...dirs: string[]): boolean => {
  for (const dir of dirs.flatMap(ancestors)) {
    try {
      const candidate = createRequire(join(dir, 'x.js'))('typescript')
      if (candidate.createSourceFile instanceof Function) {
        ts = candidate
        return true
      }
    } catch {}
  }
  return false
}

export const JSX_EXTS = new Set(['.tsx', '.jsx'])

export const scriptKind = (ext: string): TS.ScriptKind => (JSX_EXTS.has(ext) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

export const parse = (text: string, ext: string, kind: TS.ScriptKind = scriptKind(ext)): TS.SourceFile =>
  ts.createSourceFile(`x${ext}`, text, ts.ScriptTarget.Latest, true, kind)

export const normalize = (s: string): string => s.replace(/\s+/g, ' ')
