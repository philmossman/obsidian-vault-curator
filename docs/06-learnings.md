# Vault Curator - Key Learnings

## 1. LiveSync Format Matters

- **E2EE must be OFF** for programmatic access
- Notes are stored as metadata + content chunks
- Chunks are content-addressable (hash-based)
- Path IDs are lowercase for compatibility

## 2. Local Models Are Challenging

- Hardware matters (8GB → 16GB made Ollama load)
- But reliability is inconsistent for code generation
- Service restarts sometimes needed
- GPU utilization can be spotty

## 3. Sub-Agent Methodology Works

- Clear task delegation = better results
- Keeps main context clean
- Fast iteration (25s for working code)
- Easy to test and integrate

## 4. Test End-to-End Early

- Verify sync to real vault immediately
- Don't assume LiveSync "just works"
- Screenshots prove it to stakeholders
- Real-world testing reveals edge cases

## 5. Cost-Conscious AI Strategy

- Use expensive models (Sonnet) for design/architecture
- Use cheaper/local models for repetitive tasks
- Sub-agents keep token counts low
- Total cost for Phase 1: minimal (~19k tokens)

## 6. LiveSync + Unicode Character Issues [CRITICAL]

- **Problem:** UTF-8 multibyte characters (emojis, special symbols) cause corruption
- **Symptoms:** "File seems to be corrupted! Writing prevented. (X != Y)" errors
- **Root cause:** LiveSync counts string length vs byte length differently
- **Solution:** Strip Unicode characters before writing to CouchDB
- **Characters to avoid:** Emojis, arrows, special symbols
- **Safe replacements:** [DONE] for checkmarks, -> for arrows, plain ASCII text
- **Detection:** hexdump shows e2 xx xx byte sequences for 3-byte UTF-8 chars
- **Impact:** 6-byte difference found (checkmark=3 bytes, arrow=3 bytes)

**Learning:** When building programmatic LiveSync integrations, always sanitize content to ASCII-safe characters to avoid sync corruption. This was discovered after several hours of debugging what appeared to be random file corruption.

## Next Steps

When ready to continue:

1. **Build Processor Module**
   - Scan inbox for unprocessed notes
   - Use AI to extract categories/tags
   - Generate suggestions in YAML frontmatter

2. **Build Filer Module**
   - Move notes to suggested folders
   - Apply tags automatically
   - Create backlinks to related notes

3. **Add Heartbeat Integration**
   - Auto-process inbox 2-3x daily
   - Report on notes filed
   - Keep inbox clean

4. **Implement Learning System**
   - Cache vault structure
   - Track filing patterns
   - Improve suggestions over time

## Conclusion

We successfully built a working AI-powered note capture system from Telegram to Obsidian in two days. The key breakthrough was pivoting from unreliable local model execution to a clean sub-agent code generation methodology.

**The system works.** Quick thoughts can now be captured from anywhere via Telegram and instantly appear in the Obsidian vault for later processing.

**Phase 1: Complete** ✅

---

*Part 6 of 6 - Vault Curator Build Documentation*

*Document created: 2026-02-08*

---

[[00-index|<- Back to Index]] | **Previous:** [[05-setup-guide|<- Setup Guide]]
