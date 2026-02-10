# Vault Curator - Technical Specifications

## Note Format

Every captured note includes YAML frontmatter:

```yaml
---
created: 2026-02-08T09:52:55.824Z
source: telegram
---

Your note content here
```

## Filename Convention

```
inbox/YYYY-MM-DD-HHMMSS-{first-five-words}.md
```

Example:
```
inbox/2026-02-08-095255-this-is-my-first-real.md
```

## CouchDB LiveSync Structure

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

## Code Metrics

- **vault-client.js:** ~250 lines
- **capture.js:** ~50 lines
- **telegram-capture.js:** ~60 lines
- **ARCHITECTURE.md:** ~200 lines
- **Total:** ~560 lines + documentation

## Development Metrics

### Time
- **Day 1 (Infrastructure):** ~4 hours
- **Day 2 (Capture System):** ~2 hours
- **Total:** ~6 hours for working Phase 1

### Token Usage
- Architecture design: ~3k tokens
- Sub-agent code gen: ~11k tokens
- Testing & iteration: ~5k tokens
- **Total:** ~19k tokens (~$0.20 USD)

---

*Part 4 of 6 - Vault Curator Build Documentation*

---

[[00-index|<- Back to Index]] | **Previous:** [[03-day2-building|<- Building]] | **Next:** [[05-setup-guide|Setup Guide ->]]
