# Distill Command Integration Guide

## Overview

The `/distill` command transforms daily memory logs into permanent Obsidian vault notes.

## How It Works

1. **User trigger:** `/distill [days] [dryrun]` via Telegram
2. **Handler prepares:** Scans memory files, builds extraction prompt
3. **AI extracts:** Agent analyzes logs and identifies significant insights
4. **Vault filing:** Insights are intelligently filed (update existing or create new notes)
5. **Report:** Summary sent to Telegram with actions taken

## Command Syntax

```
/distill              # Last 7 days (default)
/distill weekly       # Same as default
/distill 14           # Last 14 days
/distill all          # All memory files (~1 year)
/distill dryrun       # Preview without applying changes
```

## Integration Methods

### Method 1: Direct Session Control (Current)

The main agent session orchestrates distillation directly:

```javascript
// In OpenClaw agent session
const { exec } = require('openclaw-tools');
const fs = require('fs').promises;

// 1. Run handler to prepare extraction
const result = await exec('node vault-curator/telegram-distill-handler.js 7');

// 2. Check if extraction needed
if (result.includes('EXTRACTION_NEEDED')) {
  // 3. Read request
  const request = JSON.parse(await fs.readFile('/tmp/distill-extraction-request.json', 'utf-8'));
  
  // 4. Do AI extraction (agent has Anthropic access)
  const response = await aiExtract(request.prompt, request.content);
  
  // 5. Write insights
  await fs.writeFile('/tmp/distill-insights.json', JSON.stringify(response));
  
  // 6. Handler continues and applies insights
}
```

### Method 2: Cron Job (Automated)

Weekly automated distillation on Sundays:

```json
{
  "name": "Weekly Memory Distillation",
  "schedule": {
    "kind": "cron",
    "expr": "0 8 * * 0",
    "tz": "Europe/London"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Run weekly memory distillation: Read extraction request from /tmp/distill-extraction-request.json, extract insights using AI, save to /tmp/distill-insights.json. Use vault-curator/telegram-distill-handler.js workflow.",
    "model": "sonnet",
    "timeoutSeconds": 300
  },
  "delivery": {
    "mode": "announce",
    "channel": "telegram"
  },
  "sessionTarget": "isolated"
}
```

## File Flow

```
Memory Files (memory/*.md)
    ↓
Handler: telegram-distill-handler.js
    ↓
Request: /tmp/distill-extraction-request.json
    ↓
Agent: AI extraction with Sonnet
    ↓
Insights: /tmp/distill-insights.json
    ↓
Orchestrator: applyInsights()
    ↓
Vault: CouchDB (Obsidian LiveSync)
    ↓
Report: Telegram message
```

## Temporary Files

- `/tmp/distill-extraction-request.json` - AI prompt + memory content
- `/tmp/distill-insights.json` - Extracted insights (JSON array)

Both cleaned up after successful run.

## Output Format

```
📊 Memory Distillation Complete

📅 Period: 2026-02-10 to 2026-02-16
📁 Files scanned: 6
💡 Insights extracted: 8
📝 Notes updated: 0
✨ Notes created: 8

Actions:
✨ create: Projects/vault-curator/phase-5-complete.md
   └─ Phase 5 Memory Distillation System
📝 update: Projects/Security/security-action-plan.md
   └─ SSH Audit Results
... and 6 more
```

## Quality Control

### Extraction Filters
- **Extract:** Key decisions, lessons learned, project milestones, technical discoveries, reusable knowledge
- **Skip:** Routine tasks, heartbeats, trivial updates, already-resolved issues

### Confidence Scoring
- **0.9-1.0:** Major milestone, critical decision
- **0.7-0.9:** Important lesson, useful reference
- **0.6-0.7:** Minor learning, nice-to-have
- **<0.6:** Skipped (too trivial)

### Filing Decisions
- **Update (score ≥0.6):** Append to existing related note
- **Create (score <0.6):** New note in appropriate folder

## Monitoring

Check distillation quality:
```bash
# View recent distillation
cd vault-curator
node -e "const o = require('./distill-orchestrator'); 
  o.getMemoryContent(7).then(f => 
    console.log(\`\${f.length} files: \${f.map(x => x.date).join(', ')}\`))"

# Test extraction prompt
node distill-orchestrator.js get-prompt 7

# Dry run
node telegram-distill-handler.js 7 --dry-run
```

## Troubleshooting

### No insights extracted
- Memory files might be too routine (briefs, heartbeats)
- Try longer period: `/distill 14`
- Check extraction prompt quality

### Wrong folder suggestions
- Tune `vault-search.js` scoring weights
- Add more existing folders to vault structure
- Review `suggestFolder()` logic

### Insights not filing
- Check CouchDB connection (`vault-curator/config.json`)
- Verify VaultClient credentials
- Test with dry-run first

## Cost Estimation

**Per run (7 days):**
- Memory content: ~700 lines → ~2000 tokens
- Extraction prompt: ~500 tokens
- AI processing (Sonnet): ~3000 tokens input, ~2000 output
- **Total:** ~5000 tokens ≈ $0.08 per week

**Weekly cron:** ~$0.32/month (~$4/year)

## Next Improvements

1. **Learning from corrections:** Track manual edits, improve decisions
2. **Cross-linking:** Auto-connect related insights across time
3. **Folder tuning:** Better folder suggestion heuristics
4. **Batch processing:** Handle multiple weeks efficiently
5. **MOC generation:** Create Maps of Content for major topics

---

**Status:** ✅ Implemented and tested (2026-02-16)
**Next:** Deploy cron job for weekly automation
