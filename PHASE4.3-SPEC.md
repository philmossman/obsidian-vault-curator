# Phase 4.3: Housekeeping — `/tidy` Spec

**Status:** Spec (2026-02-17)
**Goal:** Automated vault cleanup — duplicates, dead notes, and structure enforcement.

---

## Design Principles

- **Three-tier decision making:**
  1. Rule-based, high confidence (≥0.8) → auto-fix (free, instant)
  2. Rule-based, low confidence (<0.8) → AI triage (reads content, makes call)
  3. AI confidence low → flag for Phil
- **Always reversible** — log every action, support `/undo` for tidy sessions
- **Never touch system folders** — `logs/`, `ix:iPhone/`, `ix:macbook/` are excluded from all operations
- **Report first, act second** — always print a summary of what was done / flagged
- **AI used surgically** — only on ambiguous cases to keep cost near zero

---

## Canonical Vault Structure

The following are the only valid top-level folders:

```
inbox/          ← capture landing zone
Projects/       ← active projects
Areas/          ← ongoing responsibilities  
Research/       ← research notes
Photography/    ← photography knowledge base (top-level, not under Projects/)
Atlas/          ← reference material / maps of content
Archives/       ← completed/inactive
Resources/      ← reusable references
Slipbox/        ← atomic notes / Zettelkasten
logs/           ← SYSTEM: LiveSync debug logs (never touch)
ix:*/           ← SYSTEM: LiveSync customisation sync (never touch)
```

**Root-level exceptions** (allowed to stay at root):
- `Index.md`
- `Welcome.md`

Everything else at root = misplaced.

---

## Features

### 1. Duplicate Cleaner (`/tidy dupes`)

**What it does:** Finds notes that exist at two paths with identical (or near-identical) content.

**Detection method:**
- Same filename AND same byte size → confirmed duplicate
- Same filename, different size → flag for manual review (may have diverged)

**Resolution:**
- Same filename + same size → confirmed duplicate, auto-delete non-canonical copy
- Same filename + different size → AI reads both notes, decides: merge content, keep one, or flag
- When both are in valid folders and AI is unsure → flag for Phil

**Known duplicates to fix on first run:**
- `vault-curator/*` → delete (canonical: `Projects/vault-curator/*`)
- `OpenClaw/*` → delete (canonical: `Projects/OpenClaw/*`)
- `Openclaw Claude usage monitor.md` (root) → delete (canonical: `Projects/OpenClaw/Usage/`)
- `photography-site-review-2026-02-09.md` (root) → delete (canonical: `Projects/photography/`)

---

### 2. Structure Enforcer (`/tidy structure`)

**What it does:** Ensures all notes live inside the canonical folder structure.

**Detection:** Notes at root (excluding allowed exceptions) or inside non-canonical top-level folders.

**Resolution:**
- Root-level note, clearly test/throwaway → auto-delete
- Root-level note with real content → AI reads it and routes directly to correct folder (not just inbox)
- Non-canonical folders (e.g. `vault-curator/` at root) → covered by duplicate cleaner
- Notes already in canonical folders → leave alone

---

### 3. Dead Note Cleaner (`/tidy stubs`)

**What it does:** Removes empty and test/throwaway notes.

**Auto-delete (high confidence):**
- 0-byte notes (e.g. `Untitled.md`, `Wikilink.md`)
- Notes matching test patterns: filename starts with `test-`, `Test`, `Untitled`, or content is only whitespace

**AI triage (ambiguous):**
- Notes < 50 words that don't match test patterns → AI reads content, judges: complete atomic note (keep) or abandoned draft (delete/flag)
- `inbox/review-queue/*` duplicates → AI compares to original, decides if safe to delete

---

## Command Interface

```
/tidy              → runs all three features with default threshold (0.8)
/tidy dupes        → duplicate cleaner only
/tidy structure    → structure enforcer only
/tidy stubs        → dead note cleaner only
/tidy dryrun       → preview all actions, make no changes
/tidy report       → scan and report issues only, no action
```

---

## Output Format

```
🧹 TIDY REPORT — 2026-02-17

✅ AUTO-FIXED (confidence ≥ 0.8):
  [deleted]  vault-curator/00-index.md  (duplicate of Projects/vault-curator/00-index.md)
  [deleted]  Untitled.md  (0 bytes)
  [moved]    Shopping list - 8th Feb 2026.md → inbox/

⚠️  FLAGGED FOR REVIEW:
  [review]   inbox/review-queue/crypto-trading-strategy.md  (possible duplicate of inbox/crypto-trading-strategy.md, sizes differ)

📊 SUMMARY:
  Deleted: 12 notes
  Moved: 3 notes
  Flagged: 2 notes
  Unchanged: 86 notes

Run /undo tidy-20260217 to reverse all auto-fixes.
```

---

## Implementation Plan

**Phase 1: Scanner** (`tidy-scanner.js`)
- List all vault notes
- Apply duplicate, structure, and stub detection
- Return structured issue list with confidence scores

**Phase 2: AI Triage** (`tidy-ai.js`)
- Receives low-confidence issues from scanner
- Reads note content via VaultClient
- Calls Claude (Haiku for speed/cost) with structured prompt
- Returns: action (delete/move/merge/keep/flag) + reasoning + target path if moving

**Phase 3: Executor** (`tidy-executor.js`)
- Process high-confidence rule hits → auto-fix
- Process AI-resolved issues → act on AI decision
- Process unresolved (AI also unsure) → add to review report
- Log all actions to session (for undo)

**Phase 3: Telegram handler** (`telegram-tidy.js`)
- Parse `/tidy [args]` command
- Call scanner + executor
- Format and return report

**Phase 4: Undo support**
- Reuse existing `undo.js` session pattern from `/file`

---

## Out of Scope (this phase)

- Broken link detection (low priority, young vault)
- Tag consolidation (low priority, few tags)
- Frontmatter standardisation (future)
- Orphan detection (future, needs backlink graph)

---

## Files to Create

```
vault-curator/tidy-scanner.js     ← rule-based issue detection
vault-curator/tidy-ai.js          ← AI triage for ambiguous cases (Haiku)
vault-curator/tidy-executor.js    ← applies decisions, logs for undo
vault-curator/telegram-tidy.js    ← /tidy command handler
```

Updates needed:
- `vault-curator/config.json` → add `canonicalFolders` list
- `vault-curator/README.md` → document `/tidy`

---

**Estimated build time:** 3-4 hours
**Cost per run:** ~$0.01-0.02 (Haiku only fires on ambiguous cases, typically <20 notes)
