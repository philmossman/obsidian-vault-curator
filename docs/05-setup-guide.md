# Vault Curator - Setup Guide

## Prerequisites

1. Obsidian with LiveSync plugin installed
2. CouchDB server (local or remote)
3. Node.js environment
4. Cloudflare Tunnel (optional, for remote access)
5. OpenClaw with Telegram integration

## Setup Steps

### 1. CouchDB Setup

```bash
# Install
sudo snap install couchdb

# Access Fauxton
http://localhost:5984/_utils

# Create database 'obsidian'
# Create user 'obsidian_user' with password
# Enable CORS for all origins
```

### 2. Obsidian LiveSync

```
Settings → Community Plugins → LiveSync
- Remote Database: http://localhost:5984/obsidian
- Username: obsidian_user
- Password: [your password]
- E2EE: DISABLED (critical!)
- Sync on Save: Enabled
```

### 3. Clone Vault Client

```bash
mkdir obsidian-curator
cd obsidian-curator
npm install nano

# Copy vault-client.js
# Create config.json with your credentials
```

### 4. Install Vault Curator

```bash
mkdir vault-curator
cd vault-curator

# Copy capture.js and telegram-capture.js
# Test with: node test-capture.js
```

### 5. Wire to Telegram

Add to your OpenClaw TOOLS.md:
```markdown
## Vault Curator
- `/capture <text>` - Capture note to Obsidian inbox
- Handler: vault-curator/telegram-capture.js
```

## Testing

```bash
# Test capture directly
node test-capture.js

# Test Telegram handler
node telegram-capture.js "/capture Test note"

# Verify in Obsidian
Check inbox/ folder for new note
```

## Resources

- **OpenClaw Docs:** https://docs.openclaw.ai
- **Obsidian LiveSync:** https://github.com/vrtmrz/obsidian-livesync
- **CouchDB Docs:** https://docs.couchdb.org/
- **Repository:** `/home/openclaw/.openclaw/workspace/vault-curator`

---

*Part 5 of 6 - Vault Curator Build Documentation*

---

[[00-index|<- Back to Index]] | **Previous:** [[04-technical-specs|<- Technical Specs]] | **Next:** [[06-learnings|Key Learnings ->]]
