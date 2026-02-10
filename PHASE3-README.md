# Vault Curator Phase 3: Auto-Filing

Phase 3 implements intelligent auto-filing of inbox notes based on AI suggestions from Phase 2.

## Overview

Phase 3 adds:
- **Auto-filing**: Automatically file notes from inbox to target folders
- **Learning system**: Track user corrections and improve suggestions
- **Undo functionality**: Reverse filing operations
- **Telegram integration**: File and undo via `/file` and `/undo` commands
- **Confidence filtering**: Queue low-confidence notes for manual review

## Modules

### 1. filer.js - Core Filing Logic

Main module that files notes based on AI suggestions.

**Key Functions:**
- `fileNotes(options)` - File multiple inbox notes
- `fileNote(vaultClient, note, options)` - File a single note
- `getProcessedInboxNotes(vaultClient)` - Get notes ready to file

**Options:**
- `limit` - Max notes to process (default: 10)
- `minConfidence` - Confidence threshold 0.0-1.0 (default: 0.7)
- `dryRun` - Preview without making changes (default: false)
- `sessionId` - Session ID for undo tracking (auto-generated)

**Example:**
```javascript
const { fileNotes } = require('./filer');

const results = await fileNotes({
  limit: 5,
  minConfidence: 0.7,
  dryRun: false
});

console.log(`Filed: ${results.filed}, Queued: ${results.queued}`);
```

### 2. learning.js - Learning & Pattern Tracking

Tracks user corrections and provides folder hints based on history.

**Key Functions:**
- `trackCorrection(originalPath, correctedPath, content)` - Log user corrections
- `getFolderHints(noteContent)` - Get folder suggestions from patterns
- `loadLearningData()` / `saveLearningData(data)` - Persist learning data
- `getStats()` - Get learning statistics

**Example:**
```javascript
const { trackCorrection, getFolderHints } = require('./learning');

// Track when user manually moves a note
await trackCorrection(
  'inbox/note.md',
  'projects/ai/note.md',
  noteContent
);

// Get hints for future filing
const hints = await getFolderHints('Note about machine learning...');
console.log(`Suggested: ${hints.suggestedFolder} (${hints.confidence})`);
```

**Learning Data Structure:**
```json
{
  "corrections": [
    {
      "timestamp": 1707562800000,
      "originalFolder": "inbox",
      "correctedFolder": "projects/ai",
      "keywords": ["machine", "learning", "neural"],
      "noteBasename": "note.md"
    }
  ],
  "folderPatterns": {
    "projects/ai": {
      "count": 5,
      "keywords": {
        "machine": 3,
        "learning": 5,
        "neural": 2
      }
    }
  }
}
```

### 3. undo.js - Undo Operations

Tracks filing operations and allows reversing entire sessions.

**Key Functions:**
- `trackOperation(sessionId, operation)` - Track an operation
- `undoLastFiling(sessionId)` - Undo a filing session
- `getRecentSessions(limit)` - List recent sessions
- `getSession(sessionId)` - Get session details

**Example:**
```javascript
const { undoLastFiling, getRecentSessions } = require('./undo');

// Get recent sessions
const sessions = await getRecentSessions(5);

// Undo the most recent
const results = await undoLastFiling(sessions[0].sessionId);
console.log(`Undone: ${results.undone} operations`);
```

**History Structure:**
```json
{
  "sessions": {
    "filer-1707562800000-a1b2c3d4": {
      "startTime": 1707562800000,
      "operations": [
        {
          "action": "file",
          "originalPath": "inbox/note.md",
          "targetPath": "projects/ai/note.md",
          "timestamp": 1707562800000,
          "originalContent": "...",
          "newContent": "..."
        }
      ],
      "undone": false
    }
  }
}
```

### 4. telegram-filer.js - Telegram Commands

Telegram bot integration for filing and undo operations.

**Commands:**

#### `/file [options]`
File inbox notes with optional parameters:
- `limit=N` - Process up to N notes (default: 10)
- `confidence=0.0-1.0` - Minimum confidence (default: 0.7)
- `dryrun` - Preview without filing

**Examples:**
```
/file
/file limit=5
/file limit=10 confidence=0.8
/file dryrun
/file limit=3 confidence=0.6 dryrun
```

#### `/undo [sessionId]`
Undo a filing session (defaults to most recent).

**Examples:**
```
/undo
/undo filer-1707562800000-a1b2c3d4
```

**Usage:**
```javascript
const { handleFileCommand, handleUndoCommand } = require('./telegram-filer');

const response = await handleFileCommand('limit=5 dryrun');
console.log(response); // Formatted response for Telegram
```

### 5. test-filer.js - Test Suite

Comprehensive test suite covering all Phase 3 functionality.

**Tests:**
1. Parse confidence levels
2. Parse command arguments
3. Learning system (track corrections, get hints)
4. Undo system (track operations, undo sessions)
5. Telegram handlers (file, undo commands)
6. Full filing workflow (dry-run)
7. Unicode handling (sanitization)
8. Folder creation & collision handling
9. Confidence filtering (queue low-confidence notes)
10. Tags and backlinks application

**Run Tests:**
```bash
cd /home/openclaw/.openclaw/workspace/vault-curator
node test-filer.js
```

## Configuration

Add `filer` section to `config.json`:

```json
{
  "filer": {
    "defaultLimit": 10,
    "minConfidence": 0.7,
    "reviewQueuePath": "inbox/review-queue/",
    "enableLearning": true,
    "maxHistorySessions": 100
  }
}
```

## Workflow

### 1. Capture Note
```bash
# Via Telegram
/capture My note about machine learning
```

### 2. Process Note (Phase 2)
```bash
# Via Telegram
/process limit=1
```
This adds AI suggestions to note frontmatter:
```yaml
ai_suggestions:
  folder: projects/ai
  tags: [machine-learning, ai]
  related: [projects/ai/neural-nets.md]
  summary: Note about ML concepts
  confidence: high
```

### 3. File Note (Phase 3)
```bash
# Via Telegram
/file limit=1

# Or with custom options
/file limit=5 confidence=0.8
```

**What happens:**
1. Reads inbox notes with `ai_suggestions`
2. Filters by confidence threshold
3. Creates target folders if needed
4. Handles filename collisions (adds -1, -2, etc.)
5. Moves note to target folder
6. Applies tags from suggestions
7. Adds backlinks to related notes
8. Tracks operation for undo

### 4. Review Low-Confidence Notes
Notes below confidence threshold are moved to `inbox/review-queue/` instead of auto-filed.

### 5. Undo if Needed
```bash
# Via Telegram
/undo
```

## Key Features

### Confidence Filtering
- **High (0.9)**: Auto-file with confidence
- **Medium (0.6)**: Auto-file if above threshold
- **Low (0.3)**: Queue for manual review

### Filename Collision Handling
If target path exists, adds numeric suffix:
- `note.md` → `note-1.md`
- `note-1.md` → `note-2.md`
- etc.

### Learning System
Tracks manual corrections:
```javascript
// User manually moves a note
await trackCorrection(
  'inbox/note.md',        // Where AI suggested
  'projects/crypto/note.md', // Where user moved it
  noteContent
);

// Future suggestions improved
const hints = await getFolderHints('Blockchain note...');
// hints.suggestedFolder = 'projects/crypto' (learned pattern)
```

### Undo System
Complete operation history:
```javascript
// Each filing session tracked
const sessions = await getRecentSessions();
// [
//   {
//     sessionId: 'filer-1707562800000-a1b2c3d4',
//     startTime: 1707562800000,
//     operationCount: 5,
//     actions: ['file', 'file', 'queue', 'file', 'file']
//   }
// ]

// Undo entire session
await undoLastFiling(sessionId);
// Restores all notes to inbox
```

### Unicode Sanitization
All content sanitized before CouchDB write:
- ✅ → `[DONE]`
- 📝 → `[NOTE]`
- 🎯 → `[TARGET]`
- → → `->`
- etc.

## Integration with Telegram

Add to `~/.openclaw/telegram-commands.json`:

```json
{
  "/file": {
    "description": "File inbox notes based on AI suggestions",
    "handler": "/home/openclaw/.openclaw/workspace/vault-curator/telegram-filer.js",
    "args": "file"
  },
  "/undo": {
    "description": "Undo last filing operation",
    "handler": "/home/openclaw/.openclaw/workspace/vault-curator/telegram-filer.js",
    "args": "undo"
  }
}
```

## File Structure

```
vault-curator/
├── filer.js              # Core filing logic
├── learning.js           # Learning & pattern tracking
├── undo.js               # Undo functionality
├── telegram-filer.js     # Telegram integration
├── test-filer.js         # Test suite
├── learning-data.json    # Learning data (auto-created)
├── filing-history.json   # Filing history (auto-created)
└── config.json           # Configuration (updated)
```

## Error Handling

All modules handle errors gracefully:
- **File not found**: Skipped, not counted as failure
- **CouchDB errors**: Caught and reported
- **Invalid confidence**: Defaults to 0.5
- **Missing AI suggestions**: Skipped
- **Undo failures**: Individual operations fail, rest continue

## Performance

- **Filing**: ~1-2 seconds per note (CouchDB I/O)
- **Learning**: O(n) keyword matching (fast)
- **Undo**: ~1-2 seconds per operation
- **History**: Keeps last 100 sessions (auto-cleanup)

## Testing

Run comprehensive test suite:
```bash
node test-filer.js
```

Expected output:
```
🧪 Running Vault Curator Phase 3 Tests

==================================================
✅ Parse "high" confidence
✅ Parse "medium" confidence
...
==================================================

📊 Test Results: 31 passed, 0 failed
✅ All tests passed!
```

## Next Steps

### Phase 4 (Future)
- **Auto-tagging**: Extract tags from content
- **Related notes**: Find connections via content analysis
- **Folder suggestions**: Suggest new folders based on patterns
- **Bulk operations**: File entire inbox in one command
- **Statistics dashboard**: Track filing accuracy over time

## Troubleshooting

### Notes not filing
1. Check if notes have `ai_suggestions` in frontmatter
2. Verify confidence threshold (try lower value)
3. Run with `dryrun` to preview
4. Check CouchDB connection

### Undo not working
1. Verify session ID exists: `getRecentSessions()`
2. Check `filing-history.json` file
3. Ensure original notes still exist

### Learning not improving
1. Track more corrections: `trackCorrection(...)`
2. Check `learning-data.json` has patterns
3. Verify keyword extraction working

### Unicode issues
1. All content auto-sanitized before CouchDB write
2. Check vault-client.js `sanitizeUnicode()` function
3. Test with `test-emoji.js` from Phase 2

## Support

For issues or questions:
1. Check test suite: `node test-filer.js`
2. Review logs in console output
3. Verify config.json settings
4. Check CouchDB connection

---

**Phase 3 Complete!** ✅

Auto-filing, learning, and undo functionality fully implemented and tested.
