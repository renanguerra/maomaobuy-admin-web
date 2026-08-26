@AGENTS.md

## Git workflow

- Never commit directly to `main`. Before starting any new feature or code change (each new chat/task), create a new branch from `main`.
- Sync first: `git checkout main && git pull` before branching off.
- Branch naming: `feature/<short-description>` for features, `fix/<short-description>` for bug fixes.
- Each task gets its own branch; do not reuse a branch left over from an unrelated task.
