import { basename } from 'node:path'
import { CODE_EXTS, editsOf, editTarget, loadTsFor, readExisting } from '../lib/edits.ts'
import type { Rule, Span } from '../lib/types.ts'
import { JSX_EXTS, parse, ts, type TS } from '../lib/typescript.ts'

const MAX_LISTED = 3
const MAX_LEN = 20
const PRAGMA = /^(biome-ignore|eslint|@ts-|ts-ignore|ts-expect-error)/
const TEMPORARY = /^TEMPORARY\b/

type Comment = { pos: number; end: number; body: string }

function collectComments(
  text: string,
  ext: string,
  scriptKind: TS.ScriptKind,
  seen: Set<number>,
  out: Comment[],
  emptyJsxExpressions: Span[],
): void {
  const sf = parse(text, ext, scriptKind)
  const visit = (node: TS.Node) => {
    if (ts.isJsxExpression(node) && !node.expression) {
      emptyJsxExpressions.push({ start: node.getStart(sf), end: node.end })
    }
    const ranges = [
      ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(text, node.getEnd()) ?? []),
    ]
    for (const r of ranges) {
      if (seen.has(r.pos)) continue
      seen.add(r.pos)
      const body = text
        .slice(r.pos, r.end)
        .replace(/^\/\/|^\/\*|\*\/$/g, '')
        .replace(/^\s*\*/gm, '')
        .split(/\s+/)
        .join(' ')
        .trim()
      if (body && !PRAGMA.test(body) && !TEMPORARY.test(body)) out.push({ pos: r.pos, end: r.end, body })
    }
    for (const child of node.getChildren(sf)) visit(child)
  }
  visit(sf)
}

function scan(text: string, ext: string): { comments: Comment[]; emptyJsxExpressions: Span[] } {
  const seen = new Set<number>()
  const comments: Comment[] = []
  const emptyJsxExpressions: Span[] = []
  collectComments(text, ext, JSX_EXTS.has(ext) ? ts.ScriptKind.TSX : ts.ScriptKind.TS, seen, comments, emptyJsxExpressions)
  if (JSX_EXTS.has(ext)) collectComments(text, ext, ts.ScriptKind.TS, seen, comments, [])
  comments.sort((a, b) => a.pos - b.pos)
  return { comments, emptyJsxExpressions }
}

function novelComments(before: Comment[], after: Comment[]): Comment[] {
  const remaining = new Map<string, number>()
  for (const c of before) remaining.set(c.body, (remaining.get(c.body) ?? 0) + 1)
  return after.filter((c) => {
    const left = remaining.get(c.body) ?? 0
    if (left > 0) remaining.set(c.body, left - 1)
    return left === 0
  })
}

function removeRange(text: string, start: number, end: number): string {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const newline = text.indexOf('\n', end)
  const lineEnd = newline === -1 ? text.length : newline
  const lead = text.slice(lineStart, start)
  const trail = text.slice(end, lineEnd)
  const left = text.slice(0, start)
  const right = text.slice(end)
  if (!lead.trim() && !trail.trim()) {
    if (newline !== -1) return text.slice(0, lineStart) + text.slice(newline + 1)
    return lineStart > 0 ? text.slice(0, lineStart - 1) : ''
  }
  if (!lead.trim()) return left + right.replace(/^[ \t]+/, '')
  if (/[ \t]$/.test(left) && (/^[ \t]/.test(right) || !trail.trim())) return left.replace(/[ \t]+$/, '') + right
  return left + right
}

function stripComments(text: string, comments: Comment[], emptyJsxExpressions: Span[]): string {
  const ranges = new Map<string, Span>()
  for (const c of comments) {
    const container = emptyJsxExpressions.find((j) => c.pos >= j.start && c.end <= j.end)
    const range = container ?? { start: c.pos, end: c.end }
    ranges.set(`${range.start}:${range.end}`, range)
  }
  let out = text
  for (const r of [...ranges.values()].sort((a, b) => b.start - a.start)) out = removeRange(out, r.start, r.end)
  return out
}

export function addedComments(pairs: [string, string][], ext: string): { count: number; bodies: string[] } {
  let count = 0
  const bodies: string[] = []
  for (const [old, next] of pairs) {
    const before = scan(old, ext).comments.map((c) => c.body)
    const after = scan(next, ext).comments.map((c) => c.body)
    count += after.length - before.length
    for (const body of after) if (!before.includes(body)) bodies.push(body)
  }
  return { count, bodies }
}

export function withoutNewComments(old: string, next: string, ext: string): string | null {
  const before = scan(old, ext).comments
  const { comments: after, emptyJsxExpressions } = scan(next, ext)
  const count = after.length - before.length
  if (count <= 0) return next
  const novel = novelComments(before, after)
  if (novel.length !== count) return null
  return stripComments(next, novel, emptyJsxExpressions)
}

function denial(path: string, pairs: [string, string][], ext: string): string {
  const { count, bodies } = addedComments(pairs, ext)
  const listed = bodies
    .slice(0, MAX_LISTED)
    .map((body) => `  ${body.length > MAX_LEN ? `${body.slice(0, MAX_LEN)}...` : body}`)
    .join('\n')
  const more = bodies.length > MAX_LISTED ? `\n  ...and ${bodies.length - MAX_LISTED} more` : ''
  return (
    `Blocked: adds ${count} new comment(s) to ${basename(path)}. ` +
    `Make the code self-explanatory instead of commenting it. If comments are required, then request the user to add a comment instead. Comments beginning with "TEMPORARY" are permitted\n${listed}${more}`
  )
}

export const noNewComments = {
  name: 'no-new-comments',
  transform(data) {
    const target = editTarget(data, CODE_EXTS)
    if (!target) return null
    if (!loadTsFor(data, target)) return null
    const { tool, input, path, ext } = target

    const edits =
      tool === 'Write' ? [{ old_string: readExisting(path), new_string: input.content ?? '' }] : editsOf(input)
    const pairs: [string, string][] = edits.map((e) => [e.old_string ?? '', e.new_string ?? ''])
    const stripped = pairs.map(([old, next]) => withoutNewComments(old, next, ext))
    if (stripped.some((s) => s === null)) return { kind: 'deny', reason: denial(path, pairs, ext) }
    if (stripped.every((s, i) => s === pairs[i][1])) return null
    const kept = stripped.map((s) => s ?? '')

    const updatedInput =
      tool === 'Write'
        ? { ...input, content: kept[0] }
        : input.edits
          ? { ...input, edits: input.edits.map((e, i) => ({ ...e, new_string: kept[i] })) }
          : { ...input, new_string: kept[0] }
    return {
      kind: 'rewrite',
      updatedInput,
      context: `The no-new-comments hook removed comments added by this edit to ${basename(path)}. Comments beginning with "TEMPORARY" are kept.`,
    }
  },
} as const satisfies Rule
