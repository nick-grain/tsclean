import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname } from 'node:path'
import type { Edit, Found, HookInput, Span, TextEdit, ToolInput } from './types.ts'
import { loadTs } from './typescript.ts'

export const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit']
export const CODE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
export const TS_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts'])
export const TEST_FILE = /\.test\.[cm]?[jt]sx?$/

export type Target = {
  tool: string
  input: ToolInput
  path: string
  ext: string
}

export function editTarget(data: HookInput, exts: Set<string>): Target | null {
  const tool = data.tool_name ?? ''
  const input = data.tool_input ?? {}
  const path = input.file_path ?? ''
  const ext = extname(path)
  if (!EDIT_TOOLS.includes(tool) || !exts.has(ext)) return null
  return { tool, input, path, ext }
}

export const loadTsFor = (data: HookInput, target: Target): boolean =>
  loadTs(dirname(target.path), data.cwd ?? process.cwd())

export const editsOf = (input: ToolInput): Edit[] => input.edits ?? [input]

export const insertedTexts = (target: Target): string[] =>
  target.tool === 'Write' ? [target.input.content ?? ''] : editsOf(target.input).map((e) => e.new_string ?? '')

export const readExisting = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '')

export type Applied = { after: string; regions: Span[] }

export function applyEdit(text: string, oldString: string, newString: string, replaceAll: boolean): Applied | null {
  if (oldString === '') return text === '' ? { after: newString, regions: [{ start: 0, end: newString.length }] } : null
  if (!text.includes(oldString)) return null
  let after = ''
  const regions: Span[] = []
  let cursor = 0
  for (;;) {
    const idx = text.indexOf(oldString, cursor)
    if (idx === -1) break
    after += text.slice(cursor, idx)
    regions.push({ start: after.length, end: after.length + newString.length })
    after += newString
    cursor = idx + oldString.length
    if (!replaceAll) break
  }
  return { after: after + text.slice(cursor), regions }
}

export function applyTextEdits(text: string, offset: number, edits: TextEdit[]): string {
  let out = text
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start - offset) + e.text + out.slice(e.end - offset)
  }
  return out
}

export const overlapsAny = (span: Span, regions: Span[]): boolean =>
  regions.some((r) => span.start < r.end && span.end > r.start)

export function writtenByEdits(
  before: string,
  edits: Edit[],
  ext: string,
  find: (text: string, ext: string) => Found[],
): string[] {
  let state = before
  const written: string[] = []
  for (const e of edits) {
    const applied = applyEdit(state, e.old_string ?? '', e.new_string ?? '', !!e.replace_all)
    if (!applied) return []
    for (const f of find(applied.after, ext)) {
      if (overlapsAny(f, applied.regions)) written.push(f.text)
    }
    state = applied.after
  }
  return written
}
