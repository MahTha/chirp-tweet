---
description: Create a plan file for implementing a spec
argument-hint: "Feature name e.g. Registration"
allowed-tools: Read, Write, Glob
---

User input: $ARGUMENTS

## Step 1 — Ensure spec exists
- Look in `.claude/specs/` for the most recent spec that matches the feature name.  
- If no spec is found, STOP and tell the user to create one first using `create-spec.md`.

## Step 2 — Determine step number
- Extract the step number from the spec filename (e.g. `02-registration.md`).  
- Use the same step number for the plan file.

## Step 3 — Parse arguments
From $ARGUMENTS extract:
1. `feature_title` — Title Case (e.g. "Registration").  
2. `feature_slug` — kebab‑case (e.g. `registration`).  
3. `plan_file` — `.claude/plans/<step_number>-<feature_slug>.md`.

## Step 4 — Research spec
Read the corresponding spec file in `.claude/specs/`.  
- Confirm overview, routes, database changes, templates, files, dependencies, rules, and definition of done.  
- Use this as the foundation for the plan.

## Step 5 — Write plan
Generate a plan with this exact structure:

---
# Plan: <feature_title>

## Overview
Summarize the feature and its purpose.

## Tasks
Break down implementation into small, ordered steps:
- Database changes (SQL migrations, schema updates).
- Backend routes (Express handlers, middleware).
- Frontend templates/components (React/Vite).
- Tests (unit + integration).
- Styling/theming updates.

## Files to modify
List all files from the spec that need changes.

## Files to create
List all new files from the spec.

## Dependencies
List any new packages to install. If none, state "No new dependencies".

## Rules to follow
Carry over rules from the spec (e.g. parameterized queries, CSS variables, password hashing).

## Definition of done
Repeat the checklist from the spec, but framed as tasks to verify after implementation.
---

## Step 6 — Save plan
Save to `.claude/plans/<step_number>-<feature_slug>.md`.

## Step 7 — Report summary
Print:
```
Plan file: .claude/plans/<step_number>-<feature_slug>.md
Title:     <feature_title>
```

Then instruct:
"Review the plan at `.claude/plans/<step_number>-<feature_slug>.md`.  
When ready, enter Implementation Mode to begin coding."