# Skill Registry — FinanzasApp

**Generated**: 2026-06-17
**Source**: User skills (OpenCode ~/.config/opencode/skills/)
**Project conventions**: AGENTS.md (project root)

---

## User Skills

### branch-pr — PR creation workflow
**Trigger**: Creating a PR, opening a PR, or preparing changes for review.
**Compact Rules**:
- Every PR MUST link an approved `status:approved` issue — no exceptions
- Every PR MUST have exactly one `type:*` label
- Automated checks must pass before merge
- Use conventional commits during implementation
- Branch naming: `type/description`
- Open PR using the template

### chained-pr — Split large PRs into reviewable slices
**Trigger**: When a PR exceeds 400 changed lines, or planning chained/stacked PRs.
**Compact Rules**:
- MUST split when a PR exceeds 400 changed lines (additions + deletions)
- Design each PR for ≤60-minute human review
- Every chained PR MUST state what came before and what comes next
- Every chained PR MUST be independently understandable and verifiable
- One deliverable work unit per PR; do not mix unrelated refactors/features/tests/docs
- Include a dependency diagram marking the current PR
- Child PRs target the previous PR's branch (in feature branch chain strategy)

### cognitive-doc-design — Reduce reader cognitive load in docs
**Trigger**: Writing guides, READMEs, RFCs, onboarding docs, architecture docs, or review docs.
**Compact Rules**:
- Lead with the answer: decision/outcome first, context after
- Progressive disclosure: happy path first, then details/edge cases
- Chunking: group related info into small sections
- Signposting: headings, labels, callouts, summaries
- Recognition over recall: tables, checklists, examples over prose
- Review empathy: design so reviewers verify intent without reconstructing the story

### comment-writer — Warm, direct human comments
**Trigger**: Drafting feedback, review comments, maintainer replies, Slack messages, GitHub comments.
**Compact Rules**:
- Start with the actionable point, don't recap the whole PR first
- Sound like a thoughtful teammate, not a corporate bot
- 1-3 short paragraphs or a tight bullet list
- Explain WHY when asking for a change
- Avoid pile-ons: comment on the highest-value issue only
- Match thread language: Spanish → Rioplatense voseo (podés, tenés, fijate)
- No em dashes; use commas, periods, or parentheses

### go-testing — Go test patterns (Gentleman.Dots)
**Trigger**: Writing Go tests, using teatest, adding test coverage.
**Compact Rules**:
- Use table-driven tests for multiple cases (standard Go pattern)
- Bubbletea TUI: use teatest for model testing
- Golden file testing for complex output verification
- Prefer `t.Fatal` over `t.Error` when continuing makes no sense
- Use `t.Cleanup` for resource teardown
- Run `go test ./...` before committing

### issue-creation — GitHub issue workflow
**Trigger**: Creating a GitHub issue, reporting a bug, or requesting a feature.
**Compact Rules**:
- Blank issues are disabled — MUST use a template (Bug Report or Feature Request)
- Every issue gets `status:needs-review` automatically on creation
- A maintainer MUST add `status:approved` before any PR can be opened
- Search for duplicates before creating
- Questions go to Discussions, not issues

### judgment-day — Parallel adversarial review
**Trigger**: User says "judgment day", "dual review", "doble review", "juzgar".
**Compact Rules**:
- Launch TWO independent blind judge sub-agents simultaneously (parallel, never sequential)
- Neither judge knows about the other
- Synthesize findings, apply fixes, re-judge until both pass
- Max 2 iterations, then escalate
- Must resolve skill registry before launching judges
- Inject matching compact rules into BOTH judge prompts as `## Project Standards (auto-resolved)`

### karpathy-guidelines — Reduce LLM coding pitfalls
**Trigger**: Writing, reviewing, or refactoring code.
**Compact Rules**:
- **Think Before Coding**: state assumptions explicitly, surface tradeoffs, name confusion
- **Simplicity First**: minimum code that solves the problem, no speculative abstractions
- **Surgical Changes**: change only what's needed, don't refactor unrelated code
- **Goal-Driven Execution**: define success criteria before starting, stop when criteria are met
- **Self-Check**: review your own diff before presenting it
- **Context Budget**: stay within the token/line budget for the task

### skill-creator — Create new AI agent skills
**Trigger**: User asks to create a new skill, add agent instructions, or document patterns for AI.
**Compact Rules**:
- Only create when patterns are used repeatedly AND AI needs guidance
- Do NOT create when documentation already exists or pattern is trivial
- Structure: `skills/{name}/SKILL.md` (required) + optional `assets/` and `references/`
- SKILL.md must have frontmatter (name, description, license, metadata)
- Include Critical Patterns section with actionable rules and one-line examples
- Use the Agent Skills spec format

### work-unit-commits — Structure commits as deliverables
**Trigger**: Implementing a change, preparing commits, splitting PRs, chained PRs.
**Compact Rules**:
- Commit by work unit (a deliverable behavior, fix, migration, or docs)
- Do NOT commit by file type (avoid separate models/services/tests commits)
- Keep tests with the code they verify (same commit)
- Keep docs with the user-visible change they explain
- Each commit should be independently reviewable
- If SDD forecasts >400 lines, group commits into chained PR slices before implementing

---

## Project Conventions (from AGENTS.md)

| Convention | Rule |
|---|---|
| HTML | Semantic HTML5, Bootstrap 5.3 classes, labels for all inputs |
| CSS | No `!important` unless necessary, use CSS variables for colors |
| JavaScript | `const`/`let` (no `var`), arrow functions for callbacks, immutable patterns (spread, map, filter), input validation before processing |
| Git | Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`), no AI attribution in commits |
