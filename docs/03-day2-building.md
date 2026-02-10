# Vault Curator - Day 2: Building the Curator

**Date:** 2026-02-08  
**Focus:** Architecture, code generation, and Telegram integration

## Architecture Design

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

## The Ollama Challenge

**Problem discovered:** Even with RAM upgrade (8GB → 16GB), Ollama models were getting killed.

**Investigation:**
1. Qwen2.5-Coder worked for trivial prompts ("hello world")
2. But timed out or got killed for actual code generation
3. GPU wasn't being utilized (0% usage, 1MiB memory)
4. Required Ollama service restart to load model into GPU
5. Even then, code generation was unreliable

**Decision:** Pivot to sub-agent methodology for code generation.

## Sub-Agent Code Generation (The Breakthrough)

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

## Testing & Integration

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

*Part 3 of 6 - Vault Curator Build Documentation*

---

[[00-index|<- Back to Index]] | **Previous:** [[02-day1-infrastructure|<- Infrastructure]] | **Next:** [[04-technical-specs|Technical Specs ->]]
