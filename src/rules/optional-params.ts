import { applyEdit, applyTextEdits, editsOf, editTarget, loadTsFor, readExisting, TS_EXTS } from '../lib/edits.ts'
import type { Edit, Rule, Span, TextEdit } from '../lib/types.ts'
import { JSX_EXTS, normalize, parse, ts, type TS } from '../lib/typescript.ts'

type UnionParam = TS.ParameterDeclaration & { type: TS.UnionTypeNode; name: TS.Identifier }

type Offender = Span & {
  text: string
  inScope: boolean
  fixable: boolean
  edits: TextEdit[]
}

const isUndefinedType = (t: TS.TypeNode) => t.kind === ts.SyntaxKind.UndefinedKeyword
const isOptionalParam = (p: TS.ParameterDeclaration) => !!(p.questionToken || p.initializer || p.dotDotDotToken)

function parses(text: string, ext: string): TS.SourceFile[] {
  const kinds = JSX_EXTS.has(ext) ? [ts.ScriptKind.TSX, ts.ScriptKind.TS] : [ts.ScriptKind.TS]
  return kinds.map((kind) => parse(text, ext, kind))
}

function hasUndefinedInUnion(p: TS.ParameterDeclaration): p is UnionParam {
  const t = p.type
  return (
    !!t &&
    ts.isUnionTypeNode(t) &&
    t.types.some(isUndefinedType) &&
    !t.types.every(isUndefinedType) &&
    ts.isIdentifier(p.name) &&
    p.name.text !== 'this' &&
    !p.initializer &&
    !p.dotDotDotToken
  )
}

function paramEdits(p: UnionParam, sf: TS.SourceFile): TextEdit[] {
  const members = p.type.types
  const undefinedCount = members.filter(isUndefinedType).length
  const at = members.findIndex(isUndefinedType)
  const removal =
    undefinedCount > 1
      ? {
          start: p.type.getStart(sf),
          end: p.type.end,
          text: members
            .filter((m) => !isUndefinedType(m))
            .map((m) => m.getText(sf))
            .join(' | '),
        }
      : at > 0
        ? { start: members[at - 1].end, end: members[at].end, text: '' }
        : { start: members[0].getStart(sf), end: members[1].getStart(sf), text: '' }
  return p.questionToken ? [removal] : [{ start: p.name.end, end: p.name.end, text: '?' }, removal]
}

function offendingParams(text: string, ext: string, inScope: (s: Span) => boolean = () => false): Offender[] {
  const found = new Map<number, Offender>()
  for (const sf of parses(text, ext)) {
    const visit = (node: TS.Node) => {
      const takesOptionalParams =
        ts.isFunctionLike(node) && !ts.isIndexSignatureDeclaration(node) && !ts.isSetAccessorDeclaration(node)
      if (takesOptionalParams) {
        const list = node.parameters
          .filter(hasUndefinedInUnion)
          .map((p) => ({ param: p, start: p.getStart(sf), end: p.end }))
        const listInScope = list.some(inScope)
        let restOptional = true
        for (let i = node.parameters.length - 1; i >= 0; i--) {
          const p = node.parameters[i]
          if (!hasUndefinedInUnion(p)) {
            restOptional &&= isOptionalParam(p)
            continue
          }
          const start = p.getStart(sf)
          const fixable = !!p.questionToken || restOptional
          if (!(listInScope && fixable) && !p.questionToken) restOptional = false
          if (!found.has(start)) {
            found.set(start, {
              start,
              end: p.end,
              text: normalize(p.getText(sf)),
              inScope: listInScope,
              fixable,
              edits: paramEdits(p, sf),
            })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return [...found.values()].sort((a, b) => a.start - b.start)
}

function newlyIntroduced(params: Offender[], baseline: Offender[]): Offender[] {
  const remaining = new Map<string, number>()
  for (const p of baseline) remaining.set(p.text, (remaining.get(p.text) ?? 0) + 1)
  return params.filter((p) => {
    const left = remaining.get(p.text) ?? 0
    if (left > 0) remaining.set(p.text, left - 1)
    return left === 0
  })
}

function expandSingleRegion(
  before: string,
  after: string,
  region: Span,
  oldString: string,
  newString: string,
  fixes: Offender[],
): { old_string: string; new_string: string } {
  const lo = Math.min(region.start, ...fixes.map((f) => f.start))
  const hi = Math.max(region.end, ...fixes.map((f) => f.end))
  const delta = newString.length - oldString.length
  return {
    old_string: before.slice(lo, hi - delta),
    new_string: applyTextEdits(
      after.slice(lo, hi),
      lo,
      fixes.flatMap((f) => f.edits),
    ),
  }
}

function sharedRelativeEdits(regions: Span[], fixes: Offender[]): TextEdit[] | null {
  const perRegion = regions.map((r) =>
    fixes
      .filter((f) => f.start < r.end && f.end > r.start)
      .flatMap((f) => f.edits)
      .map((e) => ({ start: e.start - r.start, end: e.end - r.start, text: e.text, inside: e.start >= r.start && e.end <= r.end })),
  )
  const key = (edits: (TextEdit & { inside: boolean })[]) => JSON.stringify(edits)
  const consistent = perRegion.every((edits) => edits.every((e) => e.inside) && key(edits) === key(perRegion[0]))
  return consistent ? perRegion[0] : null
}

function rewriteEdit(before: string, baseline: Offender[], e: Edit, ext: string): { edit: Edit; offenders: Offender[] } {
  const oldString = e.old_string ?? ''
  const newString = e.new_string ?? ''
  const unchanged = { edit: e, offenders: [] }
  if (!newString.includes('undefined')) return unchanged
  const applied = applyEdit(before, oldString, newString, !!e.replace_all)
  if (!applied) return unchanged
  const { after, regions } = applied

  const touchesEdit = (p: Span) => regions.some((r) => p.start < r.end && p.end > r.start)
  const params = offendingParams(after, ext, touchesEdit).filter((p) => p.inScope)
  const fixes = params.filter((p) => p.fixable)
  const blocked = params.filter((p) => !p.fixable)

  if (fixes.length === 0) return { edit: e, offenders: newlyIntroduced(blocked, baseline) }
  if (regions.length === 1) {
    return {
      edit: { ...e, ...expandSingleRegion(before, after, regions[0], oldString, newString, fixes) },
      offenders: newlyIntroduced(blocked, baseline),
    }
  }
  const shared = sharedRelativeEdits(regions, fixes)
  if (!shared) return { edit: e, offenders: newlyIntroduced(params, baseline) }
  return {
    edit: { ...e, new_string: applyTextEdits(newString, 0, shared) },
    offenders: newlyIntroduced(blocked, baseline),
  }
}

export function rewriteAll(
  before: string,
  edits: Edit[],
  ext: string,
  baselineText: string = before,
): { edits: Edit[]; changed: boolean; offenders: string[] } {
  const baseline = offendingParams(baselineText, ext)
  let state = before
  const offenders: Offender[] = []
  const out = edits.map((e) => {
    const result = rewriteEdit(state, baseline, e, ext)
    offenders.push(...result.offenders)
    const applied = applyEdit(state, result.edit.old_string ?? '', result.edit.new_string ?? '', !!result.edit.replace_all)
    if (applied) state = applied.after
    return result.edit
  })
  const changed = out.some((e, i) => e.old_string !== edits[i].old_string || e.new_string !== edits[i].new_string)
  return { edits: out, changed, offenders: [...new Set(offenders.map((o) => o.text))] }
}

export const optionalParams = {
  name: 'optional-params',
  transform(data) {
    const target = editTarget(data, TS_EXTS)
    if (!target) return null
    if (!loadTsFor(data, target)) return null
    const { tool, input, path, ext } = target

    const existing = readExisting(path)
    const { edits, changed, offenders } =
      tool === 'Write'
        ? rewriteAll('', [{ old_string: '', new_string: input.content ?? '' }], ext, existing)
        : rewriteAll(existing, editsOf(input), ext)

    if (offenders.length > 0) {
      return {
        kind: 'deny',
        reason:
          'Blocked: optional parameters must be typed `x?: T`, never `x: T | undefined` or `x?: T | undefined`. ' +
          'These are followed by a required parameter, so they cannot become optional. Move them after the required parameters or take an options object.\n' +
          offenders.map((o) => `  ${o}`).join('\n'),
      }
    }
    if (!changed) return null

    const updatedInput =
      tool === 'Write'
        ? { ...input, content: edits[0].new_string }
        : input.edits
          ? { ...input, edits }
          : { ...input, old_string: edits[0].old_string, new_string: edits[0].new_string }
    return {
      kind: 'rewrite',
      updatedInput,
      context:
        'The optional-params hook rewrote `x: T | undefined` and `x?: T | undefined` parameters to `x?: T` in this edit before applying it (widening old_string to cover the parameter list if needed); the file contains the rewritten form.',
    }
  },
} as const satisfies Rule
