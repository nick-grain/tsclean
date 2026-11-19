#!/bin/sh
set -eu

settings="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"

command -v jq >/dev/null || { echo "uninstall: jq is required" >&2; exit 1; }
[ -f "$settings" ] || { echo "uninstall: $settings not found" >&2; exit 0; }
cp "$settings" "$settings.bak-tsclean"

tmp=$(mktemp)
jq '
  def ours: (.command // "") | test("tsclean/src/hook\\.ts");
  if .hooks.PreToolUse then
    .hooks.PreToolUse = [ .hooks.PreToolUse[]
      | .hooks = [ .hooks[] | select(ours | not) ]
      | select(.hooks | length > 0) ]
  else . end
' "$settings" > "$tmp"
mv "$tmp" "$settings"

echo "tsclean hook removed from $settings (backup: $settings.bak-tsclean)"
