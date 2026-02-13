# Phase 4: Housekeeping & Maintenance - Planning Document

**Date:** 2026-02-13  
**Status:** Planning  
**Target:** Q1 2026

---

## Overview

Phase 4 adds vault maintenance and housekeeping capabilities to keep the vault clean, consistent, and well-organized.

**Core Philosophy:** Automated cleanup + structural integrity + readability improvements

---

## Feature 1: Note Formatter (Priority 1)

### Problem Statement
Captured notes (especially from Telegram) have poor formatting:
- Markdown tables are ugly and hard to read
- Inconsistent heading levels
- Poor whitespace/spacing
- Mixed list styles
- Missing line breaks

**Example:** The crypto trading summary captured today looks terrible and needs manual cleanup.

### Requirements

**Must Have:**
1. Format markdown tables properly (spacing, alignment)
2. Standardize heading hierarchy (# → ## → ###)
3. Normalize list markers (- vs * vs +)
4. Add proper whitespace between sections
5. Preserve content (no data loss)
6. Preserve frontmatter
7. Unicode-safe (no corruption)
8. Dry-run mode

**Nice to Have:**
1. House style enforcement (customizable rules)
2. Auto-fix common typos
3. Smart line-wrapping (80/120 char limit)
4. Code block detection and formatting
5. Link cleanup ([[double brackets]] vs regular)

### Technical Approach

**Option 1: Markdown Parser** (Recommended)
- Use `remark` or `markdown-it` parser
- AST transformation
- Controlled formatting
- Preserves structure

**Option 2: Regex-based**
- Simple pattern matching
- Faster but fragile
- Risk of breaking edge cases

**Recommendation:** Use `remark` + `remark-stringify` with custom formatting rules.

### Implementation Plan

**Files to Create:**
1. `formatter.js` - Core formatting logic
2. `telegram-formatter.js` - Telegram command handler
3. `test-formatter.js` - Test suite
4. `formatting-rules.json` - Configurable style rules

**API Design:**
```javascript
const { formatNote, formatMultiple } = require('./formatter');

// Format single note
const result = await formatNote('inbox/note.md', {
  dryRun: false,
  preserveOriginal: true  // Keep backup
});

// Format multiple notes
const results = await formatMultiple(['inbox/*.md'], {
  filter: 'source:telegram',  // Only format telegram captures
  limit: 10
});
```

**Telegram Commands:**
- `/format` - Format most recent capture
- `/format <path>` - Format specific note
- `/format inbox` - Format all inbox notes
- `/format dryrun` - Preview changes

### Success Criteria
- ✅ Tables are readable
- ✅ Headings follow hierarchy
- ✅ Consistent list styles
- ✅ Proper whitespace
- ✅ No content loss
- ✅ No Unicode corruption
- ✅ Test coverage >90%

---

## Feature 2: Vault Structure Auditor (Priority 2)

### Problem Statement
Need logical, scalable vault structure that:
- Follows best practices (PARA/Zettelkasten/Johnny Decimal)
- Scales as vault grows
- Makes notes easy to find
- Prevents sprawl and chaos

### Research Phase

**Obsidian Structure Philosophies:**

1. **PARA Method** (Tiago Forte)
   - Projects/ (active, time-bound)
   - Areas/ (ongoing responsibilities)
   - Resources/ (references, knowledge)
   - Archives/ (completed/inactive)

2. **Zettelkasten**
   - Flat structure, heavy linking
   - Index notes (MOCs)
   - Atomic notes
   - Permanent vs Fleeting vs Literature notes

3. **Johnny Decimal** 
   - Numbered hierarchy (10-19, 20-29, etc.)
   - Max 10 items per level
   - Consistent, predictable
   - Example: `10-19 Projects/12 Photography/12.01 Client Work`

4. **Hybrid Approaches**
   - Combine PARA structure with Zettelkasten linking
   - Add Johnny Decimal numbering to PARA categories

**Phil's Current Structure:**
```
/Archives
/Areas
/Atlas
/Index.md
/logs
/OpenClaw
/Projects
  /crypto-trader
/Resources
/Shopping list - 8th Feb 2026.md  ← Misplaced
/Slipbox
/vault-curator
  /obsidian
  /telegram-integration
/Welcome.md  ← Root clutter
```

**Observations:**
- PARA-inspired (Projects/Areas/Resources/Archives)
- Root-level clutter (loose files)
- Inconsistent depth (vault-curator has deep nesting)
- Missing MOCs/index notes

### Requirements

**Must Have:**
1. Audit current structure
2. Identify misplaced notes
3. Suggest folder moves
4. Detect root-level clutter
5. Check folder depth (flag >4 levels)
6. Report orphaned folders (empty or single note)
7. Generate structure report (markdown)

**Nice to Have:**
1. Suggest folder consolidation
2. Recommend MOC creation
3. Enforce naming conventions
4. Structure visualization (tree diagram)
5. Compare to best practices (score/grade)

### Technical Approach

**Analysis Steps:**
1. Scan vault structure (use cached vault-structure.json)
2. Classify folders (Projects/Areas/Resources/Archives/Other)
3. Identify outliers (root files, deep nesting, single-note folders)
4. Generate recommendations
5. Create report with proposed changes

**Algorithm:**
```javascript
async function auditStructure() {
  const structure = await loadVaultStructure();
  
  // 1. Detect root clutter
  const rootFiles = structure.notes.filter(n => !n.path.includes('/'));
  
  // 2. Check folder depth
  const deepFolders = findDeepNesting(structure, maxDepth: 4);
  
  // 3. Find orphaned folders
  const orphans = findOrphans(structure, minNotes: 2);
  
  // 4. Suggest moves
  const suggestions = generateMovesSuggestions(rootFiles, orphans);
  
  // 5. Structure health score
  const score = calculateHealth(structure);
  
  return {
    score,
    rootClutter: rootFiles.length,
    deepFolders: deepFolders.length,
    orphans: orphans.length,
    suggestions
  };
}
```

### Implementation Plan

**Files to Create:**
1. `auditor.js` - Structure analysis logic
2. `telegram-auditor.js` - Telegram command handler
3. `test-auditor.js` - Test suite
4. `structure-rules.json` - Configurable rules

**Telegram Commands:**
- `/audit structure` - Full structure audit
- `/audit clutter` - Just find root-level files
- `/audit depth` - Find deep nesting
- `/audit orphans` - Find empty/single-note folders

### Success Criteria
- ✅ Identifies misplaced notes
- ✅ Suggests logical moves
- ✅ Detects structural issues
- ✅ Generates actionable report
- ✅ Health score/grade
- ✅ Helps maintain structure over time

---

## Feature 3: Orphan Detection

### Problem
Notes with no incoming backlinks are isolated — hard to find, easy to forget.

### Solution
- Scan all notes for backlinks
- Identify notes with 0 incoming links
- Report orphaned notes by folder
- Suggest potential connections (AI-based)

**Command:** `/tidy orphans`

---

## Feature 4: Duplicate Scanner

### Problem
Accidental duplicate captures or similar content in multiple notes.

### Solution
- Content similarity detection (fuzzy matching)
- Title similarity
- Date-based detection (same day captures)
- Report likely duplicates
- Suggest merge or delete

**Command:** `/tidy duplicates`

---

## Feature 5: Broken Link Fixer

### Problem
`[[wikilinks]]` that don't resolve to real notes.

### Solution
- Scan all `[[links]]`
- Check if target exists
- Report broken links by note
- Suggest fixes (similar note names, folder moves)

**Command:** `/tidy links`

---

## Feature 6: Tag Consolidation

### Problem
Similar tags fragment content (photography vs photo vs photos).

### Solution
- Tag usage statistics
- Similarity detection (edit distance, synonyms)
- Suggest merges
- Optional: auto-replace in notes

**Command:** `/tidy tags`

---

## Feature 7: Stale Content Archival

### Problem
Old notes clutter active workspace.

### Solution
- Check last modified date
- Flag notes untouched >6 months
- Suggest archival
- Optional: auto-move to Archives/

**Command:** `/tidy stale`

---

## Feature 8: Empty Folder Cleanup

### Problem
Folders with no notes waste space and clutter hierarchy.

### Solution
- Find empty folders
- Find single-note folders (may be unnecessary structure)
- Suggest deletion or consolidation

**Command:** `/tidy empty`

---

## Feature 9: Frontmatter Standardizer

### Problem
Inconsistent metadata across notes.

### Solution
- Define required fields (created, tags, etc.)
- Scan all notes
- Add missing frontmatter
- Standardize date formats
- Optional: add default tags by folder

**Command:** `/tidy frontmatter`

---

## Feature 10: Stub Detection

### Problem
Very short notes or placeholders that need expansion.

### Solution
- Find notes <50 words
- Find notes with only heading (no body)
- Report stubs by folder
- Suggest expansion or deletion

**Command:** `/tidy stubs`

---

## Unified Tidy Command

**Master command:** `/tidy [all|orphans|duplicates|links|tags|stale|empty|frontmatter|stubs]`

**Examples:**
- `/tidy all` - Run full housekeeping suite
- `/tidy orphans links` - Just orphans and broken links
- `/tidy dryrun` - Preview all changes

---

## Implementation Priority

**Phase 4.1 (First Release):**
1. ✅ Note Formatter
2. ✅ Vault Structure Auditor

**Phase 4.2 (Follow-up):**
3. Orphan Detection
4. Broken Link Fixer
5. Tag Consolidation

**Phase 4.3 (Polish):**
6. Duplicate Scanner
7. Stale Content Archival
8. Empty Folder Cleanup
9. Frontmatter Standardizer
10. Stub Detection

---

## Testing Strategy

**Unit Tests:**
- Each feature module has dedicated test file
- Mock CouchDB/vault data
- Test edge cases (Unicode, empty notes, etc.)

**Integration Tests:**
- Test on real vault (safe copy)
- Verify no data loss
- Undo/rollback functionality

**User Acceptance:**
- Phil reviews formatter output
- Phil reviews structure audit recommendations
- Iterate on rules/style

---

## Timeline Estimate

**Phase 4.1 (Formatter + Auditor):**
- Planning: ✅ Done (today)
- Implementation: 2-3 days
- Testing: 1 day
- Documentation: 1 day
- **Total:** ~1 week

**Phase 4.2 & 4.3:**
- Each feature: 1-2 days
- **Total:** 2-3 weeks

**Full Phase 4:** ~1 month

---

## Next Steps

1. ✅ Document roadmap (DONE)
2. ✅ Create planning doc (DONE)
3. 🚧 Start implementation: Note Formatter
4. Test formatter with crypto trading note
5. Move to Vault Structure Auditor
6. Release Phase 4.1
7. Iterate based on feedback

---

**Ready to start coding?** Let's build the Note Formatter first! 🚀
