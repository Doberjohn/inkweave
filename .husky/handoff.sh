# Sourced first by each .husky hook. A worktree can pin core.hooksPath to the
# MAIN checkout's .husky/_ (every worktree on the dev box does, in its
# config.worktree), and then git runs the main checkout's copy of each hook for
# commits and pushes made in that worktree. Hand off to the copy in the
# checkout being committed or pushed, so a branch's hook edits gate that
# branch. This works only once the main checkout's branch has this file. A
# no-op when the running hook already is that copy, when that checkout has no
# such hook, and inside the handed-off run. INKWEAVE_HOOK_HANDOFF=1 skips the
# hand-off (runs the main checkout's copy).
#
# The check compares hook files (-ef), not checkout roots: git exports GIT_DIR
# to hooks run from a linked worktree, and `git -C <dir> rev-parse
# --show-toplevel` then answers <dir> itself.
if [ -z "${INKWEAVE_HOOK_HANDOFF:-}" ]; then
  hook=$(basename "$0")
  top=$(git rev-parse --show-toplevel 2>/dev/null) || top=
  if [ -n "$top" ] && [ -f "$top/.husky/$hook" ] && ! [ "$0" -ef "$top/.husky/$hook" ]; then
    INKWEAVE_HOOK_HANDOFF=1
    export INKWEAVE_HOOK_HANDOFF
    echo "husky - running $top/.husky/$hook (this checkout's copy)"
    exec sh -e "$top/.husky/$hook" "$@"
  fi
fi
