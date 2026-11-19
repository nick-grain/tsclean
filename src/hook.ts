import { readFileSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { isEnabled, loadConfig } from './config.ts'
import type { HookInput, Rule, ToolInput } from './lib/types.ts'
import { RULES } from './rules/index.ts'

type HookOutput = {
  hookSpecificOutput:
    | { hookEventName: 'PreToolUse'; permissionDecision: 'deny'; permissionDecisionReason: string }
    | { hookEventName: 'PreToolUse'; updatedInput: ToolInput; additionalContext: string }
}

export function run(data: HookInput, rules: readonly Rule[]): HookOutput | null {
  let toolInput = data.tool_input
  const contexts: string[] = []

  for (const rule of rules) {
    const result = rule.transform({ ...data, tool_input: toolInput })
    if (!result) continue
    if (result.kind === 'deny') {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: result.reason,
        },
      }
    }
    toolInput = result.updatedInput
    contexts.push(result.context)
  }

  if (contexts.length === 0 || !toolInput) return null
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: toolInput,
      additionalContext: contexts.join(' '),
    },
  }
}

async function main() {
  const data: HookInput = JSON.parse(readFileSync(0, 'utf8'))
  const config = await loadConfig()
  const output = run(
    data,
    RULES.filter((r) => isEnabled(config, r.name)),
  )
  if (output) process.stdout.write(JSON.stringify(output))
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
if (isMain) await main()
