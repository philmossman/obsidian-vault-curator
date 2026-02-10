# Vault Curator - Architecture Design

## Overview
AI-powered note management system for Obsidian vaults via CouchDB/LiveSync.

## Goals
1. **Quick Capture**: Telegram → Inbox (instant)
2. **Smart Filing**: AI categorizes, tags, and files notes
3. **Learning System**: Adapts to vault structure over time
4. **Cost Conscious**: Use local models where possible

## Components

### 1. Capture Module (`capture.js`)
- Listen for Telegram messages with specific trigger
- Create inbox notes in CouchDB
- Format: `inbox/YYYY-MM-DD-HHMMSS-{title}.md`
- Metadata: timestamp, source (telegram), raw content

### 2. Vault Client (`vault-client.js`)
- CouchDB LiveSync interface (already built ✅)
- CRUD operations on notes
- Search/query capabilities
- Tag and folder management

### 3. Processor Module (`processor.js`)
- Scan inbox folder for unprocessed notes
- AI analysis (Qwen2.5-Coder for speed/cost)
- Extract: category, tags, related notes, suggested folder
- Generate cleaned/formatted content

### 4. Filer Module (`filer.js`)
- Move notes from inbox → proper location
- Apply tags and metadata
- Create links to related notes
- Archive or delete processed items

### 5. Learner Module (`learner.js`)
- Analyze vault structure (folders, tags, patterns)
- Build "filing rules" over time
- Cache common patterns to reduce AI calls
- Improve suggestions based on feedback

## Data Flow

```
Telegram Message
    ↓
[Capture] → CouchDB inbox/note.md
    ↓
[Heartbeat/Manual Trigger]
    ↓
[Processor] → Analyze with AI
    ↓
[Filer] → Move & organize
    ↓
Synced to vault ✅
```

## Interaction Model

### Telegram Commands
- `/capture <text>` - Quick note to inbox
- `/process` - Process inbox now
- `/vault status` - Show inbox count, recent activity
- `/vault search <query>` - Search vault

### Heartbeat Integration
- Check inbox 2-3x daily (morning, afternoon, evening)
- Process if >5 notes OR >24h since last check
- Report summary if notes were filed

### Manual Processing
- User can trigger anytime via `/process`
- Show processing progress
- Confirm where notes were filed

## AI Strategy

### Qwen2.5-Coder (Local, Fast, Free)
- Note categorization
- Tag extraction
- Folder suggestion
- Content cleanup

**Prompt Template**:
```
Analyze this note and suggest:
- Folder: [path]
- Tags: [list]
- Related: [existing notes]

Note: {content}
Vault structure: {folders/tags}

Reply JSON only.
```

### Claude Sonnet (Complex Cases)
- Ambiguous notes
- Multi-topic content
- Restructuring suggestions
- When Qwen fails/unclear

## Vault Structure Awareness

Cache in `vault-structure.json`:
```json
{
  "folders": [
    {"path": "Projects", "count": 45},
    {"path": "Reference", "count": 120},
    {"path": "Journal", "count": 300}
  ],
  "tags": {
    "work": 150,
    "personal": 200,
    "photography": 75
  },
  "updated": "2026-02-08T09:00:00Z"
}
```

Refresh:
- After each processing run
- Max age: 6 hours
- Incremental updates

## Error Handling

- **CouchDB down**: Queue captures locally, sync when online
- **AI unavailable**: Fall back to simple keyword matching
- **Ambiguous filing**: Leave in inbox with AI suggestions as comment
- **Conflicts**: User decides, system learns from choice

## Phase 1 Implementation (Today)

1. ✅ Vault client (done yesterday)
2. Capture module (Telegram → inbox)
3. Basic processor (AI analysis)
4. Simple filer (move notes)
5. Test workflow end-to-end

## Phase 2 (Future)

- Learning system
- Smart linking
- Batch operations
- Web interface
- Voice capture via nodes

## Tech Stack

- **Language**: Node.js (already using for vault client)
- **AI**: Ollama (Qwen2.5-Coder) + Anthropic API (Sonnet fallback)
- **Storage**: CouchDB via LiveSync protocol
- **Interface**: Telegram Bot API via OpenClaw
- **Config**: JSON files in workspace

---

**Design Status**: Ready for implementation
**Next**: Generate code with Qwen2.5-Coder
