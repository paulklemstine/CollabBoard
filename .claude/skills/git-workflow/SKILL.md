---
name: git-workflow
description: Git worktree workflow for parallel feature development. Use when creating branches, starting features, or managing worktrees.
---

# Git Worktree Workflow

## Why Worktrees?

- Work on multiple features simultaneously without switching branches
- Keep dev server running in one worktree while working in another
- Each worktree has its own working directory and node_modules
- Test features in isolation without merge conflicts

## Repository Structure

```
CollabBoard/              # Main worktree (production/main branch)
├── .git/                 # Git metadata (shared by all worktrees)
├── src/
├── package.json
└── ...

CollabBoard-feature-1/    # Feature worktree (sibling directory)
CollabBoard-feature-2/    # Another feature worktree
```

## Creating a New Worktree

```bash
# From main repository
cd /mnt/c/Gauntlet/CollabBoard

# Create worktree with new branch
git worktree add ../CollabBoard-feature-name -b feature-name

# Set up dependencies
cd ../CollabBoard-feature-name
npm install
npm run dev
```

## Full Workflow

1. **Create worktree:**
   ```bash
   git worktree add ../CollabBoard-scaling-fix -b fix/scaling-rotation
   ```

2. **Work in worktree:**
   ```bash
   cd ../CollabBoard-scaling-fix
   npm install
   # Make changes, commit
   ```

3. **Merge when ready:**
   ```bash
   cd /mnt/c/Gauntlet/CollabBoard
   git checkout main
   git merge fix/scaling-rotation
   ```

4. **Clean up:**
   ```bash
   git worktree remove ../CollabBoard-scaling-fix
   git branch -d fix/scaling-rotation
   ```

## Commands

| Command | Purpose |
|---------|---------|
| `git worktree list` | List all worktrees |
| `git worktree add ../NAME -b BRANCH` | Create new worktree |
| `git worktree remove ../NAME` | Remove a worktree |
| `git worktree prune` | Clean up stale entries |

## Rules

- **NEVER switch branches** in main worktree — create a new worktree instead
- **ALWAYS create worktree** for new features, experiments, or bug fixes
- **Keep main worktree clean** — only merge from feature worktrees
- **Delete worktrees** after merging to avoid clutter
- **Run `npm install`** in each new worktree (separate node_modules)
