import { test } from 'node:test'
import { addedComments, withoutNewComments } from '../src/rules/no-new-comments.ts'
import { eq } from './helpers.ts'

const run = (o: string, n: string) => addedComments([[o, n]], '.ts').count
const runTsx = (o: string, n: string) => addedComments([[o, n]], '.tsx').count
const strip = (o: string, n: string, ext = '.ts') => withoutNewComments(o, n, ext)

test('no-new-comments: counting', () => {
  eq(run('const a = 1', 'const a = 1 // why'), 1, 'new line comment')
  eq(run('// why\nconst a = 1', '// why\nconst a = 2'), 0, 'kept comment')
  eq(run('// why\nconst a = 1', '// different words\nconst a = 1'), 0, 'reworded comment')
  eq(run('// why\nconst a = 1', 'const a = 1'), -1, 'deleted comment')
  eq(run('const a = 1', 'const a = "// not a comment"'), 0, 'string literal')
  eq(run('const a = 1', 'const a = /\\/\\//g'), 0, 'regex literal')
  eq(run('const a = 1', 'const a = 1 // biome-ignore lint: x'), 0, 'pragma')
  eq(run('const a = 1', '/** docs */\nconst a = 1'), 1, 'jsdoc')
  eq(run('const a = 1', 'const a = 1 // TEMPORARY: remove after launch'), 0, 'temporary line comment')
  eq(run('const a = 1', '/** TEMPORARY docs */\nconst a = 1'), 0, 'temporary jsdoc')
  eq(run('const a = 1', 'const a = 1 // temporary fix'), 1, 'lowercase temporary')
  eq(run('const a = 1', 'const a = 1 // not TEMPORARY'), 1, 'temporary not a prefix')
  eq(run('const a = 1', 'const a = 1 // TEMPORARYish'), 1, 'temporary as word prefix only')
  eq(runTsx('const f = <T>(x: T) => x', 'const f = <T>(x: T) => x // comment'), 1, 'tsx bare generic arrow')
  eq(runTsx('const a = <div/>', 'const a = <div>{/* hi */}</div>'), 1, 'tsx jsx comment')
})

test('no-new-comments: stripping', () => {
  eq(strip('const a = 1', 'const a = 1 // why'), 'const a = 1', 'strip trailing')
  eq(strip('const a = 1', '// why\nconst a = 1'), 'const a = 1', 'strip full line')
  eq(strip('if (x) {\n  a()\n}', 'if (x) {\n  // why\n  a()\n}'), 'if (x) {\n  a()\n}', 'strip indented line')
  eq(strip('const a = 1', '/**\n * docs\n */\nconst a = 1'), 'const a = 1', 'strip multiline jsdoc')
  eq(strip('f(a, b)', 'f(a, /* b */ b)'), 'f(a, b)', 'strip inline block')
  eq(strip('const a = 1', '/* why */ const a = 1'), 'const a = 1', 'strip leading block')
  eq(strip('a()', 'a()\n// why'), 'a()', 'strip last line')
  eq(strip('// keep\nconst a = 1', '// keep\nconst a = 1 // why'), '// keep\nconst a = 1', 'keeps existing')
  eq(strip('// why\nconst a = 1', '// why\nconst a = 1 // why'), '// why\nconst a = 1', 'duplicate body')
  eq(strip('const a = 1', 'const a = 1 // TEMPORARY: x'), 'const a = 1 // TEMPORARY: x', 'keeps temporary')
  eq(strip('const a = 1', 'const a = 1 // biome-ignore lint: x'), 'const a = 1 // biome-ignore lint: x', 'keeps pragma')
  eq(strip('const a = 1', 'const a = "// no"'), 'const a = "// no"', 'string untouched')
  eq(strip('function f() {\n}', 'function f() { /* c */ }'), 'function f() { }', 'block braces kept')
  eq(strip('const a = <div/>', 'const a = <div>{/* hi */}</div>', '.tsx'), 'const a = <div></div>', 'strip jsx comment')
  eq(strip('// old\nconst a = 1', '// new\nconst a = 1 // why'), null, 'reworded plus added')
})
