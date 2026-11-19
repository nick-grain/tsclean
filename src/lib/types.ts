export type Edit = {
  old_string?: string
  new_string?: string
  replace_all?: boolean
}

export type ToolInput = Edit & {
  file_path?: string
  content?: string
  edits?: Edit[]
}

export type HookInput = {
  tool_name?: string
  tool_input?: ToolInput
  cwd?: string
}

export type Span = { start: number; end: number }

export type Found = Span & { text: string }

export type TextEdit = Span & { text: string }

export type RuleResult =
  | { kind: 'deny'; reason: string }
  | { kind: 'rewrite'; updatedInput: ToolInput; context: string }
  | null

export type Rule = {
  name: string
  transform: (data: HookInput) => RuleResult
}
