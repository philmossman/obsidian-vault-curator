# Vault Curator

AI-powered Obsidian vault management via CouchDB/LiveSync. Captures, organises, maintains, and synthesises knowledge automatically from Telegram.

## Current Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Capture (`/capture`) | ✅ Complete |
| 2 | Process (`/process`) | ✅ Complete |
| 3 | File (`/file`) | ✅ Complete |
| 4.1 | Vault Structure Auditor (`/audit structure`) | ✅ Complete |
| 4.2 | Smart Structure Detector | ✅ Complete |
| 4.3 | Housekeeping (`/tidy`) | ✅ Complete |
| 5 | Memory Distillation (`/distill`) | ✅ Complete |
| 6 | Automation & Integration | 🔮 Future |

## Commands

### `/capture <text>`
Capture a quick note from Telegram directly into the Obsidian inbox. Supports plain text; smart structure detector auto-formats lists, tables, and headers.

### `/process [limit=N] [dryrun] [force]`
Scan inbox notes and analyse with AI. Adds folder suggestions, tags, related notes, and a summary to each note's frontmatter. Human reviews and approves.

### `/file [limit=N] [confidence=0.7] [dryrun]`
Auto-file inbox notes based on AI suggestions. Acts on high-confidence decisions, flags the rest. Learning system adapts from corrections. Supports `/undo`.

### `/audit structure`
Analyse vault organisation and surface issues: orphaned notes, empty folders, naming inconsistencies, methodology drift.

### `/tidy [dupes|structure|stubs|all] [dryrun]`
Automated housekeeping with three-tier decision making:
1. Rule-based, high confidence (≥0.8) → auto-fix
2. Low confidence → Claude/Ollama AI triage, cross-checks session memory
3. AI unsure → flagged for manual review

Detects: exact duplicates, structure violations, empty/test notes. Fully reversible via `/undo`.

### `/distill [weekly|days|all|dryrun]`
Scan `memory/*.md` daily logs, extract significant insights with AI, and write them as permanent Obsidian notes. Skips routine content (briefs, heartbeats). Only extracts insights with confidence ≥ 0.6.

Also runs automatically every Sunday at 8am UK time via cron.

## Architecture

```
vault-curator/
├── vault-client.js           # CouchDB/LiveSync interaction
├── ai-client.js              # AI client (Ollama + Anthropic fallback)
├── config.js                 # Config loader
├── config.json               # Credentials & settings
│
├── capture.js                # Phase 1: note capture
├── telegram-capture.js
│
├── processor.js              # Phase 2: AI analysis
├── telegram-processor.js
│
├── filer.js                  # Phase 3: auto-filing + learning
├── learning.js
├── undo.js
├── telegram-filer.js
│
├── structure-auditor.js      # Phase 4.1: vault structure audit
├── telegram-structure.js
│
├── formatter.js              # Phase 4.2: smart structure detector
├── telegram-formatter.js
│
├── tidy-scanner.js           # Phase 4.3: housekeeping scanner
├── tidy-ai.js                # Phase 4.3: AI triage (memory-aware)
├── tidy-executor.js          # Phase 4.3: applies decisions
├── telegram-tidy.js          # Phase 4.3: /tidy command handler
│
├── distill-orchestrator.js   # Phase 5: memory distillation
├── vault-search.js           # Phase 5: relevance scoring
├── run-distill.js            # Phase 5: entry point
├── telegram-distill.js       # Phase 5: /distill command handler
```

## Setup

```bash
cd /home/openclaw/.openclaw/workspace/vault-curator
npm install
cp config.example.json config.json
# Edit config.json with your CouchDB credentials
```

## Configuration

Key settings in `config.json`:

```json
{
  "couchdb": { "host": "...", "port": 5984, "database": "obsidian" },
  "processor": { "ollamaHost": "http://localhost:11434" },
  "tidy": {
    "canonicalFolders": ["inbox","Projects","Areas","Research","Photography","Atlas","Archives","Resources","Slipbox"],
    "systemFolders": ["logs/","ix:iphone/","ix:macbook/"],
    "autoFixThreshold": 0.8,
    "aiActThreshold": 0.6
  }
}
```

## AI Models

- **Ollama (local, free):** `llama3.1:8b`, `qwen2.5-coder:7b` — used for triage and analysis
- **Anthropic:** Sonnet for distillation (requires API key in `~/.openclaw/agents/main/agent/auth-profiles.json`)

## Key Technical Notes

- **Unicode safe:** All content sanitised before CouchDB writes (LiveSync byte-length bug)
- **VaultClient is a class:** `const vault = new VaultClient(config.couchdb)`
- **Ollama via HTTP only:** Never use `ollama run` CLI — use `http://localhost:11434/api/generate`
- **Memory cross-check:** `/tidy` AI triage searches `memory/*.md` before deciding to delete any note

## Vault Structure

PARA-style with additions:
```
inbox/          ← capture landing zone
Projects/       ← active projects
Areas/          ← ongoing responsibilities
Research/       ← research notes
Photography/    ← photography knowledge base
Atlas/          ← reference / maps of content
Archives/       ← completed / inactive
Resources/      ← reusable references
Slipbox/        ← atomic notes
logs/           ← SYSTEM: LiveSync debug logs (never touch)
ix:*/           ← SYSTEM: LiveSync customisation sync (never touch)
```

## Cost

| Feature | Model | Cost |
|---------|-------|------|
| `/capture` | None | $0 |
| `/process` | Ollama (local) | $0 |
| `/file` | Ollama (local) | $0 |
| `/tidy` | Ollama llama3.1:8b | $0 |
| `/distill` | Sonnet | ~$0.08/week |

## License

MIT
