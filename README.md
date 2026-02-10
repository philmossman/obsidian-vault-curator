# Vault Curator - Phase 2 Processor

AI-powered note processing system for Obsidian vaults via CouchDB/LiveSync.

## Overview

The Phase 2 Processor scans your Obsidian inbox, analyzes notes with AI, and adds intelligent suggestions for organization directly to each note's frontmatter.

## Features

- ✅ **Automatic Processing**: Scans inbox folder for unprocessed notes
- 🤖 **AI Analysis**: Uses Ollama (qwen2.5-coder:7b) or Claude Sonnet
- 📝 **Smart Suggestions**: Provides folder, tags, related notes, and summary
- 🔒 **Unicode Sanitization**: Prevents CouchDB corruption from emojis
- 💾 **Vault Structure Caching**: Fast processing with 6-hour cache
- 📊 **Detailed Reporting**: Complete processing summary

## Architecture

```
vault-curator/
├── processor.js          # Main processing module
├── vault-client.js       # CouchDB interaction utilities
├── ai-client.js          # AI analysis (Ollama + Claude)
├── config.js             # Configuration loader
├── telegram-processor.js # Telegram bot integration
├── test-processor.js     # Unit & integration tests
└── config.json           # Configuration file
```

## Installation

```bash
cd /home/openclaw/.openclaw/workspace/vault-curator
npm install
```

## Configuration

Copy `config.example.json` to `config.json` and edit with your credentials:

```bash
cp config.example.json config.json
# Edit config.json with your actual CouchDB credentials
```

See `config.example.json` for the configuration template.

## Usage

### Command Line

```bash
# Process up to 10 notes (default)
node telegram-processor.js /process

# Process up to 5 notes
node telegram-processor.js /process limit=5

# Dry run (no changes)
node telegram-processor.js /process dryrun

# Force reprocess already-processed notes
node telegram-processor.js /process force

# Use Claude instead of Ollama
node telegram-processor.js /process model=claude-sonnet-4-5
```

### Telegram Bot

Send these commands to your Telegram bot:

- `/process` - Process inbox with defaults
- `/process limit=5` - Process up to 5 notes
- `/process dryrun` - Preview without making changes
- `/process force` - Reprocess already-processed notes

### Programmatic Usage

```javascript
const { processInbox } = require('./processor');

(async () => {
  const results = await processInbox({
    limit: 10,
    model: 'qwen2.5-coder:7b',
    dryRun: false,
    force: false
  });
  
  console.log(`Processed: ${results.processed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);
})();
```

## How It Works

### 1. Scan Inbox

Processor scans the `inbox/` folder for notes without `processed: true` in frontmatter.

### 2. Load Vault Structure

Loads vault folder/tag structure from cache (or generates if >6 hours old).

### 3. AI Analysis

Sends each note to AI with vault context, requesting:
- **Folder**: Best location for the note
- **Tags**: Relevant tags (existing + new suggestions)
- **Related**: Paths to potentially related notes
- **Summary**: One-line summary
- **Confidence**: High/medium/low

### 4. Update Frontmatter

Adds AI suggestions to note's YAML frontmatter:

```yaml
---
created: 2026-02-10T09:00:00Z
source: telegram
processed: true
processed_at: 2026-02-10T09:30:00Z
ai_suggestions:
  folder: Projects/Photography
  tags: [equestrian, portfolio, client-work]
  related: [Projects/Photography/shoot-plan.md]
  summary: Notes from equestrian photography session with client
  confidence: high
---

Your note content here...
```

### 5. Manual Review

You review the suggestions and:
- Move notes to suggested folders
- Apply suggested tags
- Link to related notes

## Testing

```bash
# Run all tests
npm test

# Or directly
node test-processor.js
```

Tests include:
- ✅ Config loading
- ✅ Unicode sanitization
- ✅ Frontmatter parsing
- ✅ Note building
- ✅ CouchDB integration
- ✅ End-to-end processing

## Critical Features

### Unicode Sanitization

**WHY**: CouchDB/LiveSync can corrupt notes with emojis due to byte-length vs string-length mismatches.

**HOW**: All content is sanitized before writing:
- ✅ → `[DONE]`
- 🔥 → `[HOT]`
- 📝 → `[NOTE]`
- All other emojis → removed

### Vault Structure Caching

**WHY**: Scanning entire vault on every process is slow.

**HOW**: 
- Generates `vault-structure.json` with folder/tag counts
- Cache refreshed every 6 hours
- Force refresh: `node -e "require('./processor').refreshVaultStructure()"`

### AI Model Fallback

**WHY**: Ollama might be unavailable or fail.

**HOW**: Automatically falls back to Claude Sonnet if Ollama fails.

## Troubleshooting

### "Note is encrypted - E2EE must be disabled"

**Problem**: LiveSync encryption is enabled.

**Solution**: 
1. Open Obsidian settings
2. Go to LiveSync plugin settings
3. Disable End-to-End Encryption
4. Re-sync vault

### Ollama connection failed

**Problem**: Ollama service not running.

**Solution**:
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Start Ollama if needed
ollama serve
```

### No notes processed

**Problem**: All notes already have `processed: true`.

**Solution**: Use `force` option to reprocess:
```bash
node telegram-processor.js /process force
```

## Performance

- **Speed**: ~10-30 seconds per note (depends on AI model)
- **Cost**: 
  - Ollama (local): $0 per note
  - Claude Sonnet: ~$0.01-0.05 per note
- **Batch Size**: Default 10 notes per run (configurable)

## Future Enhancements

Phase 3 ideas:
- [ ] Automatic filing (not just suggestions)
- [ ] Learning system (adapt to user preferences)
- [ ] Smart linking (create wiki-style connections)
- [ ] Batch operations
- [ ] Web interface
- [ ] Voice capture integration

## License

MIT

## Support

Issues? Check:
1. CouchDB is running: `curl http://localhost:5984`
2. Ollama is running: `curl http://localhost:11434/api/tags`
3. Config is correct: `cat config.json`
4. Run tests: `npm test`
