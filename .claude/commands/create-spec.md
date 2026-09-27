---
description: Create a spec file and feature branch for the next project step
argument-hint: "Feature name and short summary e.g. Registration - allow users to sign up"
allowed-tools: Read, Write, Glob, Bash(git:*)
---

User input: $ARGUMENTS

## Step 1 — Ensure clean working directory
Run `git status`.  
- If any uncommitted, unstaged, or untracked files exist → STOP.  
- Tell the user to commit or stash changes before proceeding.  
- Do not continue until the directory is clean.

## Step 2 — Determine step number
List files in `.claude/specs/`.  
- Find the highest existing step number (e.g. 01, 02, 03).  
- Increment by 1 to assign `step_number` for this new spec.  
- Zero‑pad to 2 digits (e.g. 04, 12).

## Step 3 — Parse arguments
From $ARGUMENTS extract:
1. `feature_title` — Title Case (e.g. "Registration").  
2. `feature_summary` — short human‑readable description.  
3. `feature_slug` — kebab‑case, max 40 chars, only a‑z, 0‑9, and `-`.  
4. `branch_name` — `feature/<feature_slug>`.

If parsing fails, ask the user to clarify.

## Step 4 — Verify branch name availability
Run `git branch`.  
- If `branch_name` exists, append a suffix (`-01`, `-02`, etc.).  

## Step 5 — Sync with main
Run:
```
git checkout main
git pull origin main
```

## Step 6 — Create feature branch
Run:
```
git checkout -b <branch_name>
```

## Step 7 — Research codebase
Read:
- `CLAUDE.md` → roadmap, conventions, schema.  
- `.claude/specs/` → avoid duplicates.  
- Relevant source files.  

If the requested feature is already marked complete in `CLAUDE.md`, warn the user and stop.

## Step 8 — Write spec
Generate a spec with this exact structure:

---
# Spec: <feature_title>

## Overview
<feature_summary>

## Depends on
List previous steps required. If none, state "None".

## Routes
Every new route:
- `METHOD /path` — description — access level (public/logged‑in).  
If none, state "No new routes".

## Database changes
List new tables, columns, or constraints.  
If none, state "No database changes".

## Templates (Frontend)
- **Create:** list new templates with paths.  
- **Modify:** list existing templates and changes.  
If none, state "No template changes".

## Files to change
List all files to be modified.

## Files to create
List all new files.

## New dependencies
List new packages. If none, state "No new dependencies".

## Rules for implementation
Always include rules from `CLAUDE.md`, plus any feature‑specific constraints.

## Definition of done
Checklist of testable outcomes. Each item must be verifiable by running the app.
---

## Step 9 — Save spec
Save to `.claude/specs/<step_number>-<feature_slug>.md`.

## Step 10 — Report summary
Print:
```
Branch:    <branch_name>
Spec file: .claude/specs/<step_number>-<feature_slug>.md
Title:     <feature_title>
```

Then instruct:
"Review the spec at `.claude/specs/<step_number>-<feature_slug>.md`.  
When ready, enter Plan Mode with Shift+Tab twice to generate `.claude/plans/<step_number>-<feature_slug>.md`."