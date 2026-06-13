#!/bin/bash
# Runs at the end of every Claude session.
# If src/ files changed since the session started, calls Claude to update CLAUDE.md.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Prevent recursive invocation (this script calls `claude -p`, which would
# trigger another Stop hook without this guard).
if [ "${CLAUDE_MD_UPDATE:-}" = "1" ]; then
  exit 0
fi

# Determine what changed during this session.
# CLAUDE_MD_SESSION_BASE is set by the SessionStart hook.
BASE="${CLAUDE_MD_SESSION_BASE:-}"
if [ -n "$BASE" ]; then
  CHANGED=$(git diff "$BASE" HEAD --name-only 2>/dev/null | grep -E '^src/' | grep -v 'CLAUDE\.md' || true)
else
  # Fallback when SessionStart hook didn't run (e.g. first ever session).
  CHANGED=$(git diff HEAD~1 HEAD --name-only 2>/dev/null | grep -E '^src/' | grep -v 'CLAUDE\.md' || true)
fi

if [ -z "$CHANGED" ]; then
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Checking if CLAUDE.md needs updating…"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

export CLAUDE_MD_UPDATE=1

claude -p "$(cat <<'PROMPT'
You are maintaining CLAUDE.md for the PrivyLedger finance app.

1. Run: git log --oneline -10
2. Run: git diff "$CLAUDE_MD_SESSION_BASE" HEAD --stat 2>/dev/null || git diff HEAD~1 HEAD --stat
3. Read CLAUDE.md
4. Decide: did anything architecturally significant change? Examples of YES:
   - New Zustand store added (src/store/)
   - New page added (src/pages/)
   - New core utility or type pattern (src/core/)
   - New shared component with reuse potential (src/components/)
   - New convention established (e.g. new hook pattern, new data relationship)
   Examples of NO (do NOT modify CLAUDE.md):
   - Bug fixes, UI tweaks, label/copy changes
   - Adding a field to an existing type
   - New feature that follows already-documented patterns
5. If YES: edit CLAUDE.md to reflect the new information. Be concise — one or two sentences per new thing. Do not repeat what is already documented.
6. If NO: do nothing.
PROMPT
)" \
  --allowedTools "Bash,Read,Edit" \
  --output-format text \
  2>/dev/null || true

# Commit CLAUDE.md if it changed.
if ! git diff --quiet CLAUDE.md 2>/dev/null; then
  git add CLAUDE.md
  git commit -m "docs: auto-update CLAUDE.md" --no-verify 2>/dev/null || true
  echo "✅ CLAUDE.md updated and committed."
else
  echo "✓ CLAUDE.md is already up to date."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
