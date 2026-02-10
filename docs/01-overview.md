# Vault Curator - Overview

**Project Timeline:** 2026-02-07 to 2026-02-08  
**Status:** Phase 1 Complete ✅  
**Author:** Phil Mossman with Kryten (AI Assistant)

## The Vision

Create an intelligent note management system that:
1. Captures quick thoughts from Telegram → Obsidian inbox
2. Uses AI to categorize, tag, and organize notes automatically
3. Learns vault structure over time to improve suggestions
4. Minimizes API costs by using local models where possible

## What We Built

### Working System (Phase 1 Complete)

**User Experience:**
1. Send `/capture <your note text>` in Telegram
2. Receive confirmation with note path
3. Note appears in Obsidian inbox folder instantly
4. Complete with timestamp and source metadata

**Technical Stack:**
- **Storage:** CouchDB 3.5.1
- **Sync:** Obsidian LiveSync plugin (no E2EE)
- **Tunnel:** Cloudflare (obsidian.mossmanphotography.co.uk)
- **Backend:** Node.js with nano (CouchDB client)
- **Interface:** Telegram Bot via OpenClaw
- **AI:** Anthropic Claude Sonnet 4.5

**Code Files:**
- `/vault-curator/capture.js` - Core capture function
- `/vault-curator/telegram-capture.js` - Telegram integration
- `/obsidian-curator/vault-client.js` - CouchDB LiveSync client
- `/vault-curator/ARCHITECTURE.md` - Complete design doc

## Future Phases (Planned)

**Phase 2: Processor Module**
- AI analyzes inbox notes
- Suggests categories, tags, related notes
- Extracts key entities and concepts
- Uses local models (Qwen) to minimize costs

**Phase 3: Filer Module**
- Moves notes from inbox → proper folders
- Applies tags and metadata
- Creates links to related notes
- Learns from user corrections

**Phase 4: Learner Module**
- Analyzes vault structure over time
- Builds filing rules automatically
- Caches common patterns
- Improves suggestions based on feedback

---

*Part 1 of 6 - Vault Curator Build Documentation*

---

[[00-index|<- Back to Index]] | **Next:** [[02-day1-infrastructure|Day 1: Infrastructure ->]]
