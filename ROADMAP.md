# Vault Curator Roadmap

## Vision

AI-powered Obsidian vault management that captures, organizes, maintains, and synthesizes knowledge automatically.

---

## ✅ Phase 1: Capture (COMPLETE)

**Goal:** Quick note capture from Telegram to Obsidian inbox

**Features:**
- `/capture <text>` - Create inbox note from Telegram
- YAML frontmatter (created, source)
- Unicode sanitization (prevent LiveSync corruption)
- Direct CouchDB integration

**Status:** ✅ Implemented & working

---

## ✅ Phase 2: Process (COMPLETE)

**Goal:** AI analysis of inbox notes with intelligent suggestions

**Features:**
- `/process` - Scan inbox and analyze with AI
- Folder suggestions based on vault structure
- Tag recommendations (existing + new)
- Related note detection
- Summary generation
- Confidence scoring (high/medium/low)
- Ollama local model + Claude fallback
- Vault structure caching (6-hour TTL)

**Status:** ✅ Implemented & tested

---

## ✅ Phase 3: File (COMPLETE)

**Goal:** Intelligent auto-filing with learning & undo

**Features:**
- `/file [limit=N] [confidence=0.7] [dryrun]` - Auto-file inbox notes
- Confidence filtering (high-only, medium+, all)
- Automatic folder creation
- Tag and backlink application
- Collision handling (append `-N` to filenames)
- Learning system (track user corrections)
- `/undo [sessionId]` - Reverse entire filing sessions
- Session history (last 100 sessions)

**Status:** ✅ Implemented & tested (31 tests passing)

---

## ✅ Phase 4.1: Vault Structure Auditor (COMPLETE)

**Goal:** Analyze vault organization and provide actionable recommendations

**Command:** `/audit structure`

**Features:**
- ✅ Detect organizational methodology (PARA/Zettelkasten/ACCESS/Johnny Decimal)
- ✅ Analyze folder depth, distribution, naming consistency
- ✅ Identify structural issues (orphans, empty folders, root notes)
- ✅ Generate prioritized issue reports (high/medium/low severity)
- ✅ Provide actionable recommendations
- ✅ Comprehensive audit report formatting

**Status:** ✅ Implemented & ready for production (2026-02-15)

---

## ✅ Phase 4.2: Smart Structure Detector (COMPLETE)

**Goal:** Auto-detect structure in plain text and convert to formatted markdown

**Command:** Integrated with `/capture`

**Features:**
- ✅ Title detection (dates, ALL CAPS, title case)
- ✅ Section header detection (lines ending with `:` or `?`)
- ✅ List detection (explicit markers and implicit parallel structure)
- ✅ Key-value → table conversion
- ✅ Proper paragraph handling with spacing
- ✅ Existing markdown preservation
- ✅ 100% test coverage (31/31 tests passing)

**Status:** ✅ Complete (2026-02-13)

---

## ✅ Phase 4.3: Housekeeping Tools (COMPLETE)

**Goal:** Automated maintenance and cleanup

**Command:** `/tidy [feature]`

### Additional Features:
- **Orphan Detection** - Find notes with no backlinks
- **Duplicate Scanner** - Detect similar/duplicate content
- **Broken Link Fixer** - Find and fix `[[broken links]]`
- **Tag Consolidation** - Merge similar tags (photography vs photo)
- **Stale Content Archival** - Flag notes untouched >6 months
- **Empty Folder Cleanup** - Remove unused folders
- **Frontmatter Standardizer** - Ensure consistent metadata
- **Stub Detection** - Flag notes <50 words or missing content

**Command:** `/tidy [all|orphans|links|tags|stale|empty|frontmatter|stubs]`

**Status:** ✅ Complete (2026-02-17)

---

## ✅ Phase 5: Intelligence & Synthesis (COMPLETE)

**Goal:** Transform vault from storage into living knowledge base

### Priority: Memory → Vault Notes
**Problem:** AI memory files (daily logs, MEMORY.md) contain valuable insights that never become permanent notes
**Solution:**
- Weekly digest: scan memory files for significant learnings
- Extract: decisions, lessons learned, project milestones, discoveries
- Generate: properly formatted permanent notes
- Cross-link: connect to existing vault notes
- Curate: update index/MOC notes

**Command:** `/distill [weekly|all]`

### Additional Features:
- **Link Suggestions** - AI-powered connection discovery between notes
- **Stub Enrichment** - Expand minimal notes with context from related content
- **Context Injector** - Add background information from vault to enhance notes
- **Smart MOC Generator** - Auto-generate Maps of Content for major topics
- **Concept Extractor** - Identify recurring themes and create concept notes

**Status:** ✅ Complete (2026-02-16) — weekly cron live, `/distill` command available

---

## 🔮 Phase 6: Automation & Integration (FUTURE)

**Goal:** Proactive vault management with minimal human intervention

**Ideas:**
- Scheduled housekeeping (weekly `/tidy` cron job)
- Auto-distill (monthly memory → vault synthesis)
- Smart notifications ("You haven't updated X project in 2 weeks")
- Integration with daily brief (inject vault stats/reminders)
- Voice capture → vault notes
- Email → vault notes (important threads)
- Browser bookmarks → vault notes

**Status:** 🔮 Future vision

---

## Development Principles

1. **Manual Review First** - AI suggests, human decides (until confidence is high)
2. **Always Reversible** - Undo everything (session-based rollback)
3. **Learn From Corrections** - Track user changes, adapt suggestions
4. **Cost Conscious** - Prefer Ollama (local/free) over API calls
5. **Unicode Safe** - Sanitize all content to prevent LiveSync corruption
6. **Incremental** - Small, tested features over big rewrites

---

## Technical Debt & Improvements

- [ ] Migrate to TypeScript (better tooling, fewer bugs)
- [ ] Add proper logging framework (replace console.log)
- [ ] Web UI for vault browser/editor
- [ ] Real-time sync (watch inbox folder)
- [ ] Plugin architecture (custom processors/filters)
- [ ] Better test coverage (integration tests with real vault)
- [ ] Performance optimization (parallel processing, faster scans)
- [ ] Documentation site (ReadTheDocs style)

---

## Contributing

This is a personal project for Phil's workflow, but ideas and bug reports welcome:
- GitHub Issues: https://github.com/philmossman/obsidian-vault-curator/issues
- Pull Requests: Review before submitting (may not align with personal workflow)

---

## License

MIT

---

**Last Updated:** 2026-02-13
**Current Phase:** 4 (Planning)
**Next Milestone:** Note Formatter + Vault Structure Auditor
