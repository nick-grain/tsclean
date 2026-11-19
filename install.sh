#!/bin/sh
set -eu

repo=$(cd "$(dirname "$0")" && pwd)
settings="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
cmd="node '$repo/src/hook.ts'"

command -v jq >/dev/null || { echo "install: jq is required" >&2; exit 1; }
[ -f "$settings" ] || echo '{}' > "$settings"
cp "$settings" "$settings.bak-tsclean"

tmp=$(mktemp)
jq --arg cmd "$cmd" '
  def ours: (.command // "") | test("tsclean/src/hook\\.ts|hooks/edit-rewrites\\.mjs");
  .hooks.PreToolUse = (
    [ (.hooks.PreToolUse // [])[]
      | .hooks = [ .hooks[] | select(ours | not) ]
      | select(.hooks | length > 0) ]
    + [ { matcher: "Write|Edit|MultiEdit", hooks: [ { type: "command", command: $cmd } ] } ]
  )
' "$settings" > "$tmp"
mv "$tmp" "$settings"

echo "tsclean hook installed in $settings (backup: $settings.bak-tsclean)"
