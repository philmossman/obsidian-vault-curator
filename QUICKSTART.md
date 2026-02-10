# Vault Curator Phase 2 - Quick Start Guide

Get up and running with the processor in 60 seconds! 🚀

## Prerequisites

✅ CouchDB running on localhost:5984  
✅ Obsidian with LiveSync configured  
✅ E2EE **disabled** in LiveSync settings  
✅ Ollama running with qwen2.5-coder:7b model  

## 1. Test the Installation

```bash
cd /home/openclaw/.openclaw/workspace/vault-curator
npm test
```

Expected output: **12/12 tests passing** ✅

## 2. Try a Dry Run

```bash
node telegram-processor.js /process limit=2 dryrun
```

This will:
- Scan your inbox
- Analyze 2 notes with AI
- Show what would happen
- **Not make any changes**

## 3. Process Your First Note

```bash
node telegram-processor.js /process limit=1
```

This will:
- Process 1 note from inbox
- Add AI suggestions to frontmatter
- Show results summary

## 4. Check the Results

Open the processed note in Obsidian and look at the frontmatter:

```yaml
---
processed: true
processed_at: 2026-02-10T09:30:00Z
ai_suggestions:
  folder: Projects/YourProject
  tags: [work, important]
  related: [other/note.md]
  summary: Brief summary of the note
  confidence: high
---
```

## 5. Use via Telegram

Send to your bot:
```
/process
```

You'll get a formatted response with all the details!

## Common Commands

### Dry Run (Preview Only)
```bash
/process dryrun
```

### Process More Notes
```bash
/process limit=10
```

### Force Reprocess
```bash
/process force
```

### Use Claude Instead
```bash
/process model=claude-sonnet-4-5
```

## Workflow

1. **Capture notes** via Telegram: `/capture Your note here`
2. **Process inbox** periodically: `/process`
3. **Review suggestions** in Obsidian frontmatter
4. **Manually file** notes to suggested folders
5. **Apply tags** as suggested

## Troubleshooting

### "No notes to process"
- All notes already have `processed: true`
- Use `/process force` to reprocess

### "Connection refused"
- Check CouchDB: `curl http://localhost:5984`
- Check Ollama: `curl http://localhost:11434/api/tags`

### "Note is encrypted"
- Disable E2EE in LiveSync settings
- Re-sync your vault

## Next Steps

- Set up automatic processing via heartbeat
- Integrate with daily brief
- Build custom filing rules

## Need Help?

- Read full docs: `README.md`
- Check architecture: `ARCHITECTURE.md`
- Review implementation: `IMPLEMENTATION-SUMMARY.md`
- Run tests: `npm test`

---

**You're ready to go! 🎉**
