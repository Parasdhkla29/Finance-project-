#!/bin/bash
# Records the git HEAD at session start so the Stop hook can diff exactly
# what changed during this session.
set -euo pipefail

HEAD_HASH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "")
if [ -n "$HEAD_HASH" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export CLAUDE_MD_SESSION_BASE=$HEAD_HASH" >> "$CLAUDE_ENV_FILE"
fi
