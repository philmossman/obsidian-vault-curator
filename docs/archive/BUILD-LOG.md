# Building an AI-Powered Obsidian Vault Curator

**Project Timeline:** 2026-02-07 to 2026-02-08  
**Status:** Phase 1 Complete ✅  
**Author:** Phil Mossman with Kryten (AI Assistant)

---

## Overview

This document captures the process of building a vault curator system that allows quick note capture from Telegram directly into an Obsidian vault, using CouchDB, LiveSync, and AI-assisted code generation.

## The Vision

Create an intelligent note management system that:
1. Captures quick thoughts from Telegram → Obsidian inbox
2. Uses AI to categorize, tag, and organize notes automatically
3. Learns vault structure over time to improve suggestions
4. Minimizes API costs by using local models where possible

## Day 1: Infrastructure (2026-02-07)

### CouchDB + LiveSync Setup

**Goal:** Enable direct programmatic access to Obsidian vault via CouchDB.

**Steps:**
1. Installed CouchDB 3.5.1 via snap
2. Created admin user and obsidian_user credentials
3. Created `obsidian` database with CORS enabled
4. Set up Cloudflare Tunnel: `obsidian.mossmanphotography.co.uk` → localhost:5984
5. Configured Obsidian LiveSync plugin (without E2EE for direct markdown access)

**Key Learning:** Disabling E2EE encryption is essential for direct programmatic access to note content. With encryption, you can only access encrypted blobs.

### Vault Client Library

**Built:** Node.js library to interact with CouchDB in LiveSync format.

**Features:**
- `readNote(path)` - Read note with frontmatter
- `writeNote(path, content)` - Create/update notes
- `listNotes()` - List all vault notes
- `searchNotes(query)` - Full-text search
- `getStats()` - Vault statistics

**Technical Details:**
- LiveSync stores notes as metadata docs + content chunks
- Chunks are content-addressable (hash-based IDs: `h:xxxxx`)
- Path IDs are lowercase for case-insensitive filesystems
- Chunks are typically ~50KB each

**Test Success:** Created a test note that synced perfectly to MacBook vault.

### Model Testing & Strategy

**Tested local models:**
- **CodeLlama 7B:** Too slow (11+ min, no output) - REJECTED ❌
- **Qwen2.5-Coder 7B:** Usable (~3-4 min, clean code) - SELECTED ✅

**Strategy decided:**
- Use Sonnet (Anthropic API) for architecture and design
- Use Qwen2.5-Coder (local) for code generation to save costs
- Reserve Sonnet for complex tasks

**Credentials stored:**
- CouchDB Admin: `admin` / `[REDACTED]`
- CouchDB User: `obsidian_user` / `[REDACTED]`
- Database: `obsidian`

---

## Day 2: Vault Curator Build (2026-02-08)

### Architecture Design

**Created:** Complete architecture document (`ARCHITECTURE.md`)

**Components:**
1. **Capture Module** - Telegram → inbox notes
2. **Vault Client** - CouchDB interface (already complete)
3. **Processor Module** - AI analysis (future)
4. **Filer Module** - Smart filing (future)
5. **Learner Module** - Pattern recognition (future)

**Data Flow:**
```
Telegram /capture command
    ↓
Create inbox/YYYY-MM-DD-HHMMSS-title.md
    ↓
Sync via CouchDB LiveSync
    ↓
Appear in Obsidian vault
    ↓
[Future: AI processing & filing]
```

**Phase 1 Scope (Today):**
- Telegram capture command
- Basic inbox note creation
- End-to-end testing

### The Ollama Challenge

**Problem discovered:** Even with RAM upgrade (8GB → 16GB), Ollama models were getting killed.

**Investigation:**
1. Qwen2.5-Coder worked for trivial prompts ("hello world")
2. But timed out or got killed for actual code generation
3. GPU wasn't being utilized (0% usage, 1MiB memory)
4. Required Ollama service restart to load model into GPU
5. Even then, code generation was unreliable

**Root cause:** Ollama integration was unreliable for this use case, even with adequate hardware.

**Decision:** Pivot to sub-agent methodology for code generation.

### Sub-Agent Code Generation (The Breakthrough)

**New approach:**
1. Design architecture (Sonnet/main agent)
2. Spawn sub-agent to generate code
3. Review and integrate generated code
4. Test end-to-end

**Implementation:**
```javascript
sessions_spawn({
  task: "Create capture.js module with these requirements...",
  label: "code-gen-capture",
  cleanup: "keep"
})
```

**Result:** Clean, working code in 25 seconds! ✅

### Code Generated

**capture.js:**
- Function: `captureNote(text, metadata)`
- Filename format: `inbox/YYYY-MM-DD-HHMMSS-{first-words}.md`
- YAML frontmatter with timestamp and source
- Returns created note path
- ~50 lines of clean, well-structured JavaScript

**telegram-capture.js:**
- Detects `/capture` commands
- Extracts note text
- Creates inbox note via `captureNote()`
- Returns confirmation message
- Can be run as CLI or imported as module

### Testing & Integration

**Test 1:** Direct function call
```javascript
await captureNote(
  'This is a test note from the vault curator build session!',
  { source: 'telegram' }
);
// ✅ Created: inbox/2026-02-08-094754-this-is-a-test-note.md
```

**Test 2:** CLI invocation
```bash
node telegram-capture.js "/capture Testing the Telegram integration..."
# ✅ Note captured!
# 📝 inbox/2026-02-08-095203-testing-the-telegram-integrati.md
```

**Test 3:** Real Telegram command
```
User: /capture This is my first real capture from Telegram!
Bot: ✅ Note captured!
     📝 inbox/2026-02-08-095255-this-is-my-first-real.md
```

**Verification:** All notes appeared in Obsidian vault on MacBook within seconds via LiveSync.

---

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

### Future Phases (Planned)

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

## Key Learnings

### 1. LiveSync Format Matters
- **E2EE must be OFF** for programmatic access
- Notes are stored as metadata + content chunks
- Chunks are content-addressable (hash-based)
- Path IDs are lowercase for compatibility

### 2. Local Models Are Challenging
- Hardware matters (8GB → 16GB made Ollama load)
- But reliability is inconsistent for code generation
- Service restarts sometimes needed
- GPU utilization can be spotty

### 3. Sub-Agent Methodology Works
- Clear task delegation = better results
- Keeps main context clean
- Fast iteration (25s for working code)
- Easy to test and integrate

### 4. Test End-to-End Early
- Verify sync to real vault immediately
- Don't assume LiveSync "just works"
- Screenshots prove it to stakeholders
- Real-world testing reveals edge cases

### 5. Cost-Conscious AI Strategy
- Use expensive models (Sonnet) for design/architecture
- Use cheaper/local models for repetitive tasks
- Sub-agents keep token counts low
- Total cost for Phase 1: minimal (~15k tokens)

---

## Technical Specifications

### Note Format

Every captured note includes YAML frontmatter:

```yaml
---
created: 2026-02-08T09:52:55.824Z
source: telegram
---

Your note content here
```

### Filename Convention

```
inbox/YYYY-MM-DD-HHMMSS-{first-five-words}.md
```

Example:
```
inbox/2026-02-08-095255-this-is-my-first-real.md
```

### CouchDB LiveSync Structure

**Metadata Document:**
```json
{
  "_id": "inbox/2026-02-08-095255-this-is-my-first-real.md",
  "children": ["h:abc123def456"],
  "path": "inbox/2026-02-08-095255-this-is-my-first-real.md",
  "ctime": 1707385975824,
  "mtime": 1707385975824,
  "size": 89,
  "type": "plain"
}
```

**Chunk Document:**
```json
{
  "_id": "h:abc123def456",
  "type": "leaf",
  "data": "---\ncreated: 2026-02-08T09:52:55.824Z\nsource: telegram\n---\n\nThis is my first real capture from Telegram!"
}
```

---

## Reproducibility Guide

### Prerequisites

1. Obsidian with LiveSync plugin installed
2. CouchDB server (local or remote)
3. Node.js environment
4. Cloudflare Tunnel (optional, for remote access)
5. OpenClaw with Telegram integration

### Setup Steps

**1. CouchDB Setup**
```bash
# Install
sudo snap install couchdb

# Access Fauxton
http://localhost:5984/_utils

# Create database 'obsidian'
# Create user 'obsidian_user' with password
# Enable CORS for all origins
```

**2. Obsidian LiveSync**
```
Settings → Community Plugins → LiveSync
- Remote Database: http://localhost:5984/obsidian
- Username: obsidian_user
- Password: [your password]
- E2EE: DISABLED (critical!)
- Sync on Save: Enabled
```

**3. Clone Vault Client**
```bash
mkdir obsidian-curator
cd obsidian-curator
npm install nano

# Copy vault-client.js
# Create config.json with your credentials
```

**4. Install Vault Curator**
```bash
mkdir vault-curator
cd vault-curator

# Copy capture.js and telegram-capture.js
# Test with: node test-capture.js
```

**5. Wire to Telegram**
Add to your OpenClaw TOOLS.md:
```markdown
## Vault Curator
- `/capture <text>` - Capture note to Obsidian inbox
- Handler: vault-curator/telegram-capture.js
```

### Testing

```bash
# Test capture directly
node test-capture.js

# Test Telegram handler
node telegram-capture.js "/capture Test note"

# Verify in Obsidian
Check inbox/ folder for new note
```

---

## Metrics

### Development Time
- **Day 1 (Infrastructure):** ~4 hours
  - CouchDB setup: 1h
  - LiveSync config: 1h
  - Vault client: 1.5h
  - Model testing: 0.5h

- **Day 2 (Capture System):** ~2 hours
  - Architecture: 0.5h
  - Ollama debugging: 0.5h (abandoned)
  - Sub-agent code gen: 0.5h
  - Testing & integration: 0.5h

**Total:** ~6 hours for working Phase 1

### Code Metrics
- **vault-client.js:** ~250 lines
- **capture.js:** ~50 lines
- **telegram-capture.js:** ~60 lines
- **ARCHITECTURE.md:** ~200 lines
- **Total:** ~560 lines + documentation

### Token Usage
- Architecture design: ~3k tokens
- Sub-agent code gen: ~11k tokens
- Testing & iteration: ~5k tokens
- **Total:** ~19k tokens (~$0.20 USD)

---

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

---

## Conclusion

We successfully built a working AI-powered note capture system from Telegram to Obsidian in two days. The key breakthrough was pivoting from unreliable local model execution to a clean sub-agent code generation methodology.

**The system works.** Quick thoughts can now be captured from anywhere via Telegram and instantly appear in the Obsidian vault for later processing.

**Phase 1: Complete** ✅

---

## Resources

- **OpenClaw Docs:** https://docs.openclaw.ai
- **Obsidian LiveSync:** https://github.com/vrtmrz/obsidian-livesync
- **CouchDB Docs:** https://docs.couchdb.org/
- **Repository:** `/home/openclaw/.openclaw/workspace/vault-curator`

---

*Document created: 2026-02-08*  
*Last updated: 2026-02-08*
