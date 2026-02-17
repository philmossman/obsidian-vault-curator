# Phase 5: Memory → Vault Distillation - Specification

**Goal:** Automatically transform daily memory logs into permanent, searchable vault notes.

**Status:** 🚧 Specification phase  
**Started:** 2026-02-16  
**Target completion:** 2026-02-16

---

## Overview

Weekly automated process that:
1. Scans `memory/YYYY-MM-DD.md` files (last 7 days)
2. Extracts significant insights (decisions, learnings, milestones, discoveries)
3. Intelligently files them into vault (update existing OR create new notes)
4. Reports summary to Telegram

---

## User Stories

**As Phil, I want:**
- My daily logs automatically curated into permanent notes
- Important insights preserved and searchable in Obsidian
- Related work grouped together (not scattered across dated logs)
- No manual copy-paste or memory review effort
- Weekly digest telling me what was captured

**As the system, I must:**
- Distinguish signal from noise (skip routine, capture insights)
- Make smart update-vs-create decisions
- Maintain note quality (proper formatting, links, metadata)
- Preserve source attribution (which memory file, what date)
- Be reversible (if it makes a mistake, Phil can fix/delete)

---

## Architecture

### Components

**1. Memory Scanner** (`distiller.js`)
- Read `memory/YYYY-MM-DD.md` files for date range
- Parse into structured chunks (by session/topic)
- Filter out routine content (briefs, heartbeats, status checks)

**2. AI Analyzer** (`ai-client.js` - existing)
- Extract significant insights from memory chunks
- Categorize by type: decision, lesson, milestone, discovery, reference
- Identify topic/project associations
- Generate vault-ready markdown

**3. Vault Integrator** (`vault-client.js` - existing)
- Search vault for related notes
- Decide: update existing OR create new
- Apply changes with proper formatting
- Track what was modified

**4. Telegram Handler** (`telegram-distill.js`)
- `/distill [weekly|all]` command
- Progress updates during processing
- Summary report with links to modified notes

**5. Cron Job**
- Weekly schedule: Sundays 8am UK time
- Automated distillation of past week
- Telegram notification with results

---

## Decision Logic: Update vs Create

### Search Phase
For each extracted insight:
1. **Identify topic/project** (e.g., "vault-curator", "security-hardening", "crypto-trading")
2. **Search vault** for related notes:
   - Folder match (e.g., `Projects/vault-curator/`)
   - Title match (e.g., "BUILD-LOG", "security-action-plan")
   - Tag match (e.g., `#vault-curator`, `#security`)
3. **Score candidates** by relevance (0-1.0)

### Decision Matrix

| Condition | Action | Example |
|-----------|--------|---------|
| **Existing project log found** (score ≥0.8) | **Append** to log | vault-curator work → BUILD-LOG.md |
| **Related note exists** (0.6 ≤ score < 0.8) | **Append** if chronological update<br>**Create new** if different angle | Security findings → append to action-plan vs new research note |
| **Topic folder exists** (score < 0.6) | **Create new** note in folder | New crypto strategy → Projects/crypto-trader/new-note.md |
| **No matches found** (score < 0.3) | **Create new** note, suggest folder | Obsidian best practices → create in new folder |

### Append Guidelines
**Append when:**
- Chronological continuation of existing work
- Adding to ongoing project documentation
- Extending existing topic with new details
- Build log, action plan, or living document

**Append method:**
- Add new section with date heading
- Preserve existing structure
- Update frontmatter (modified date, add tags)

### Create Guidelines
**Create when:**
- New standalone topic or insight
- Different perspective on existing subject
- Reference material (how-to, best practice)
- Completed work deserving own note

**Create format:**
- Title from insight content
- Frontmatter: created, source, tags
- Structured sections
- Backlinks to related notes
- Source attribution (which memory file, dates)

---

## AI Prompt Design

### Extraction Prompt

```
You are analyzing daily memory logs to extract significant insights for permanent storage.

INPUT: Memory log content from {date_range}

TASK: Extract insights that should become permanent vault notes.

EXTRACT:
- Key decisions made
- Lessons learned (technical, process, mistakes)
- Project milestones (completions, major progress)
- Technical discoveries (bugs fixed, solutions found)
- Reusable knowledge (how-tos, best practices)

SKIP:
- Routine tasks (daily briefs, email checks)
- Heartbeat/status messages
- Trivial updates
- Temporary notes already resolved

OUTPUT FORMAT (JSON):
{
  "insights": [
    {
      "type": "decision|lesson|milestone|discovery|reference",
      "topic": "project or subject area",
      "title": "Brief descriptive title",
      "content": "Full markdown content",
      "source_dates": ["2026-02-16"],
      "tags": ["tag1", "tag2"],
      "confidence": 0.0-1.0,
      "related_notes": ["potential matches in vault"]
    }
  ]
}

QUALITY STANDARDS:
- Only extract truly significant content
- Prefer 3 high-quality insights over 10 trivial ones
- Group related items into single insight
- Write for future-you (clear context, no assumed knowledge)
```

### Filing Decision Prompt

```
You are deciding how to file an extracted insight into an Obsidian vault.

INSIGHT:
{insight object}

VAULT SEARCH RESULTS:
{related notes with scores}

DECISION TASK:
1. Should this UPDATE an existing note or CREATE a new one?
2. If UPDATE: which note, what section, how to integrate?
3. If CREATE: what filename, which folder, what structure?

CONSIDER:
- Is this continuing existing work? (→ append to project log)
- Is this a new standalone topic? (→ create new note)
- Is this extending existing knowledge? (→ append if chronological, create if new angle)
- Where would Phil naturally look for this? (→ folder choice)

OUTPUT FORMAT (JSON):
{
  "action": "update|create",
  "target": "path/to/note.md",
  "reasoning": "Why this decision",
  "integration": {
    "method": "append_section|prepend|insert_after",
    "heading": "Section heading if creating",
    "content": "Final formatted content"
  }
}
```

---

## Data Structures

### Insight Object
```javascript
{
  type: 'decision|lesson|milestone|discovery|reference',
  topic: 'vault-curator',
  title: 'Phase 5 distiller design decisions',
  content: '...markdown content...',
  sourceDates: ['2026-02-16'],
  tags: ['vault-curator', 'design', 'phase-5'],
  confidence: 0.85,
  relatedNotes: ['Projects/vault-curator/BUILD-LOG.md']
}
```

### Filing Decision
```javascript
{
  action: 'update',
  target: 'Projects/vault-curator/BUILD-LOG.md',
  reasoning: 'Ongoing project work, chronological continuation',
  integration: {
    method: 'append_section',
    heading: '## Phase 5: Memory Distillation (2026-02-16)',
    content: '...final markdown...'
  }
}
```

### Distillation Report
```javascript
{
  dateRange: ['2026-02-10', '2026-02-16'],
  filesScanned: 7,
  insightsExtracted: 12,
  notesUpdated: 4,
  notesCreated: 2,
  skipped: 1, // low confidence or duplicate
  actions: [
    {
      type: 'update',
      note: 'Projects/vault-curator/BUILD-LOG.md',
      insight: 'Phase 5 design and implementation'
    },
    {
      type: 'create',
      note: 'Technical-Learnings/obsidian-tag-rules.md',
      insight: 'Obsidian tag formatting requirements'
    }
  ]
}
```

---

## Filtering Logic

### Content to SKIP
- Daily brief cron outputs
- Heartbeat checks (HEARTBEAT_OK)
- Email/calendar scanning logs
- Routine status messages
- Already-resolved temporary issues
- Chat transcripts without decisions/learnings

### Content to EXTRACT
- **Decisions:** "Chose to...", "Decided against...", "Will proceed with..."
- **Lessons:** "Learned that...", "Key finding...", "Mistake was..."
- **Milestones:** "Completed...", "Released...", "Deployed..."
- **Discoveries:** "Found bug...", "Solution is...", "Works by..."
- **References:** "How to...", "Best practice...", "Rule is..."

### Confidence Scoring
- **High (≥0.8):** Clear, significant, well-documented insight
- **Medium (0.5-0.8):** Useful but minor, or needs more context
- **Low (<0.5):** Trivial, unclear, or duplicate

**Threshold:** Only file insights with confidence ≥0.6

---

## File Structure

```
vault-curator/
├── distiller.js          # Core distillation engine (NEW)
├── vault-search.js       # Enhanced search with scoring (NEW)
├── telegram-distill.js   # Telegram command handler (NEW)
├── ai-client.js          # Existing (may need extraction/filing prompts)
├── vault-client.js       # Existing (may need append/update methods)
└── PHASE5-SPEC.md        # This document
```

---

## Implementation Phases

### Phase 5.1: Core Distiller (Day 1)
- [x] Write specification (this document)
- [ ] Build `distiller.js` (memory scanner + insight extractor)
- [ ] Build `vault-search.js` (enhanced search with scoring)
- [ ] Add AI extraction prompt to `ai-client.js`
- [ ] Add append/update methods to `vault-client.js`
- [ ] Unit tests for distillation logic

### Phase 5.2: Decision Engine (Day 1)
- [ ] Build filing decision logic
- [ ] AI filing decision prompt
- [ ] Integration with vault-client
- [ ] Test update vs create scenarios

### Phase 5.3: Telegram Interface (Day 1)
- [ ] Build `telegram-distill.js`
- [ ] `/distill weekly` command
- [ ] `/distill all` command (one-time backfill)
- [ ] Progress updates during processing
- [ ] Summary report formatting

### Phase 5.4: Cron Automation (Day 1)
- [ ] Create weekly cron job (Sundays 8am UK)
- [ ] Telegram notification delivery
- [ ] Error handling and logging
- [ ] Test end-to-end

### Phase 5.5: Testing & Refinement (Day 2)
- [ ] Test with last week's memory files
- [ ] Validate decision quality (update vs create)
- [ ] Check note formatting and links
- [ ] Phil's feedback and iteration
- [ ] Documentation update

---

## Testing Strategy

### Unit Tests
- Memory file parsing (handle different formats)
- Insight extraction (skip noise, capture signal)
- Vault search scoring (accurate relevance)
- Update vs create logic (correct decisions)

### Integration Tests
- Full distillation run on sample week
- Verify vault modifications (no corruption)
- Check Telegram reports (complete, accurate)
- Cron job execution (proper timing, error handling)

### User Acceptance
- Phil reviews first automated run
- Validates quality of extracted insights
- Confirms update vs create decisions make sense
- Provides feedback for tuning

---

## Error Handling

### Graceful Degradation
- If AI fails: Log error, skip that insight, continue processing
- If vault write fails: Rollback changes, report failure
- If no insights found: Send "Nothing significant this week" message
- If cron fails: Log error, retry next week (don't accumulate)

### Safety Checks
- Dry-run mode for testing (`--dry-run` flag)
- Confirmation before modifying >5 notes
- Always preserve source attribution
- Never delete content (only add/update)

---

## Success Metrics

### Quantitative
- **Extraction rate:** 3-8 insights per week (not too few, not too many)
- **Decision accuracy:** >80% of update/create decisions feel right to Phil
- **Time saved:** ~30min/week of manual curation
- **Cost:** <$0.10/week in AI API calls

### Qualitative
- Insights are actually significant (not noise)
- Notes are well-structured and readable
- Links and tags are appropriate
- Phil trusts the system to run autonomously

---

## Future Enhancements (Beyond Phase 5)

- **Learning from corrections:** Track Phil's manual fixes, improve decisions
- **Cross-linking:** Automatically connect related insights across time
- **MOC generation:** Create Maps of Content for major topics
- **Email/chat integration:** Extract insights from other sources
- **Custom filters:** Phil defines what to extract/skip per topic
- **Multi-week synthesis:** Monthly summaries of weekly distillations

---

## Open Questions

1. **Minimum insight length?** Skip if <100 words? Or let AI judge significance?
2. **Max notes per run?** Cap at 10 to avoid overwhelming Phil?
3. **Backfill strategy?** Should `/distill all` process all historical memory files, or just recent weeks?
4. **Notification detail level?** Full content in Telegram or just summary + links?
5. **Conflict resolution?** If AI wants to update a note Phil has manually edited recently?

**Decision:** Will answer these during implementation based on real data.

---

## References

- **Vault-curator roadmap:** `vault-curator/ROADMAP.md`
- **Phase 4.1 completion:** `vault-curator/PHASE4.1-COMPLETE.md`
- **Existing vault structure:** 33 notes across Projects/, Research/, logs/, inbox/
- **Memory files location:** `/home/openclaw/.openclaw/workspace/memory/`
- **Obsidian vault:** CouchDB at localhost:5984, db "obsidian"

---

**Next Steps:**
1. Review spec with Phil (get approval)
2. Build Phase 5.1 (core distiller)
3. Test with last week's memory files
4. Iterate based on results
5. Deploy cron job

**Time estimate:** 4-6 hours development + 1-2 hours testing/refinement

---

**Status:** ✅ Specification complete, ready for build  
**Last updated:** 2026-02-16 14:48 UTC
